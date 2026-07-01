from typing import Annotated, Literal
from typing_extensions import TypedDict
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph, add_messages
from pydantic import BaseModel
from langgraph.types import interrupt
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command


class TriageState(TypedDict):
    messages: Annotated[list, add_messages]
    symptoms: list[str]
    duration: str | None
    severity: str | None
    age: int | None
    missing_information: list[str]
    red_flags: list[str]
    urgency: Literal["low", "medium", "high"]
    reasoning: str
    review_action: Literal["approve", "edited"]
    final_response: str
    last_agent: str  # tracks which worker just ran, used by supervisor


class SymptomInfo(BaseModel):
    symptoms: list[str]
    duration: str | None
    severity: str | None
    age: int | None

class RedFlags(BaseModel):
    red_flags: list[str]

class UrgencyClassifier(BaseModel):
    urgency: Literal["low", "medium", "high"]
    reasoning: str

class FollowUpQuestions(BaseModel):
    questions: list[str]

class SafetyIssues(BaseModel):
    safety_issues: list[str]

llm = ChatOllama(
    model="qwen2.5:7b",
    temperature=0,
)


# ─── Worker Nodes ────────────────────────────────────────────────────────────

def intake_agent(state: TriageState):
    """Initial intake that receives the patient request."""
    print("Patient intake received")
    return {
        "last_agent": "intake_agent"
    }


def symptom_extractor(state: TriageState):
    """Extracts medical symptoms, duration, severity, and patient age from the latest user message."""
    structured_llm = llm.with_structured_output(SymptomInfo)

    latest_user_content = state["messages"][-1].content if state["messages"] else ""

    if state.get("missing_information"):
        instruction = f"Extract values only for these missing fields:\n{state['missing_information']}"
    else:
        instruction = "Extract all available information."

    response = structured_llm.invoke(f"""
    Current information:
    Symptoms: {state.get("symptoms", [])}
    Duration: {state.get("duration")}
    Severity: {state.get("severity")}
    Age: {state.get("age")}
    Missing fields: {state.get("missing_information", [])}

    Latest user message: {latest_user_content}

    {instruction}

    STRICT RULES:
    - Symptoms are medical complaints only (e.g. "fever", "chest pain").
    - Duration must be a clear time expression (e.g. "2 days"). If unclear, return null.
    - Severity must be a clear descriptor or 1-10 number. If unclear, return null.
    - Age must be a positive integer. If unclear, return null.
    - Return null for any field that is absent or invalid.
    """)

    print(response)
    return {
        "symptoms": list(set(state.get("symptoms", []) + response.symptoms)),
        "duration": response.duration or state.get("duration"),
        "severity": response.severity or state.get("severity"),
        "age": response.age or state.get("age"),
        "last_agent": "symptom_extractor"
    }


def missing_information_node(state: TriageState):
    """Checks which required fields (duration, age, severity) are still missing."""
    missing = []
    if not state.get("duration"): missing.append("duration")
    if not state.get("age"): missing.append("age")
    if not state.get("severity"): missing.append("severity")
    return {
        "missing_information": missing,
        "last_agent": "missing_information_node"
    }


def question_generator(state: TriageState):
    """Generates and asks the user follow-up questions to gather missing information."""
    structured_llm = llm.with_structured_output(FollowUpQuestions)
    response = structured_llm.invoke(
        f"Missing info: {state.get('missing_information', [])}\nAsk concise follow-up questions to gather the missing information."
    )
    user_answer = interrupt({"questions": response.questions})
    return {
        "messages": [{"role": "user", "content": user_answer}],
        "last_agent": "question_generator"
        # NOTE: missing_information is intentionally NOT cleared here.
        # symptom_extractor needs it to know which fields to look for in the user's answer.
    }


def red_flag_detector(state: TriageState):
    """Detects serious medical red flags from the patient's information."""
    structured_llm = llm.with_structured_output(RedFlags)
    response = structured_llm.invoke(
        f"Symptoms: {state.get('symptoms', [])}\nDuration: {state.get('duration')}\nAge: {state.get('age')}\nSeverity: {state.get('severity')}\nDetect possible red flags."
    )
    print(response)
    return {
        "red_flags": response.red_flags,
        "last_agent": "red_flag_detector"
    }


def urgency_classifier(state: TriageState):
    """Classifies the urgency of the case as low, medium, or high."""
    structured_llm = llm.with_structured_output(UrgencyClassifier)
    response = structured_llm.invoke(
        f"Symptoms: {state.get('symptoms', [])}\nRed Flags: {state.get('red_flags', [])}\nClassify urgency as 'low', 'medium', or 'high'."
    )
    print(response)
    return {
        "urgency": response.urgency,
        "reasoning": response.reasoning,
        "last_agent": "urgency_classifier"
    }


def response_generator(state: TriageState):
    """Generates the final triage report for the patient."""
    safety_context = f"\nWARNING: Fix these safety issues:\n{state.get('safety_issues')}\n" if state.get("safety_issues") else ""
    response = llm.invoke(
        f"Symptoms: {state.get('symptoms', [])}\nUrgency: {state.get('urgency')}\n{safety_context}\nProvide a triage report. Do not diagnose or prescribe medications."
    )
    print(response)
    return {
        "final_response": response.content,
        "last_agent": "response_generator"
    }


def human_approval(state: TriageState):
    """Interrupts the graph for human review and approval of the generated report."""
    edits = interrupt({
        "symptoms": state.get("symptoms", []),
        "red_flags": state.get("red_flags", []),
        "urgency": state.get("urgency"),
        "reasoning": state.get("reasoning"),
        "response": state.get("final_response")
    })
    action = "approve" if edits.get("approve") else "edited"
    return {
        "urgency": edits.get("urgency", state.get("urgency")),
        "review_action": action,
        "last_agent": "human_approval"
    }


# ─── Supervisor Node ─────────────────────────────────────────────────────────

def supervisor_node(state: TriageState) -> Command:
    """
    Deterministic supervisor that routes to the next worker based on `last_agent`.
    This is reliable for all LLM sizes and avoids inference-based routing failures.
    """
    last = state.get("last_agent", "")

    print(f"Supervisor: last_agent='{last}', missing={state.get('missing_information', [])}, review_action='{state.get('review_action')}'")

    if not last or last == "intake_agent":
        return Command(goto="symptom_extractor")

    if last == "symptom_extractor":
        return Command(goto="missing_information_node")

    if last == "missing_information_node":
        if state.get("missing_information"):
            return Command(goto="question_generator")
        else:
            return Command(goto="red_flag_detector")

    if last == "question_generator":
        return Command(goto="symptom_extractor")

    if last == "red_flag_detector":
        return Command(goto="urgency_classifier")

    if last == "urgency_classifier":
        return Command(goto="response_generator")

    if last == "response_generator":
        return Command(goto="human_approval")

    if last == "human_approval":
        if state.get("review_action") == "approve":
            return Command(goto=END)
        return Command(goto="response_generator")

    # Fallback
    return Command(goto="symptom_extractor")


# ─── Graph Assembly ───────────────────────────────────────────────────────────

graph_builder = StateGraph(TriageState)

graph_builder.add_node("intake_agent", intake_agent)
graph_builder.add_node("symptom_extractor", symptom_extractor)
graph_builder.add_node("missing_information_node", missing_information_node)
graph_builder.add_node("question_generator", question_generator)
graph_builder.add_node("red_flag_detector", red_flag_detector)
graph_builder.add_node("urgency_classifier", urgency_classifier)
graph_builder.add_node("response_generator", response_generator)
graph_builder.add_node("human_approval", human_approval)
graph_builder.add_node("supervisor", supervisor_node)

graph_builder.add_edge(START, "supervisor")

graph_builder.add_edge("intake_agent", "supervisor")
graph_builder.add_edge("symptom_extractor", "supervisor")
graph_builder.add_edge("missing_information_node", "supervisor")
graph_builder.add_edge("question_generator", "supervisor")
graph_builder.add_edge("red_flag_detector", "supervisor")
graph_builder.add_edge("urgency_classifier", "supervisor")
graph_builder.add_edge("response_generator", "supervisor")
graph_builder.add_edge("human_approval", "supervisor")

memory = MemorySaver()
graph = graph_builder.compile(checkpointer=memory)


