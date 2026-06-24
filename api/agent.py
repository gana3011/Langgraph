from typing import Annotated, Literal, TypedDict

from langchain_ollama import ChatOllama
from langchain_core.messages import SystemMessage
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

    # safety_issues: list[str]
    review_action: Literal["approve", "edited"]

    final_response: str
    


class SymptomInfo(BaseModel): 
    symptoms: list[str] 
    duration: str | None 
    severity: str | None
    age: int | None

class MissingInformation(BaseModel):
    missing_information: list[str]

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

def intake_agent(state: TriageState):
    print("Patient intake received")

    return {}


def symptom_extractor(state: TriageState):

    structured_llm = llm.with_structured_output(SymptomInfo)

    latest_message = state["messages"][-1]

    if state.get("missing_information"):
        instruction = f"""
    Extract values only for these fields:

    {state["missing_information"]}
    """
    else:
        instruction = """
    Extract all available information.
    """

    response = structured_llm.invoke(
    f"""
    Current information:

    Symptoms: {state.get("symptoms", [])}
    Duration: {state.get("duration")}
    Severity: {state.get("severity")}
    Age: {state.get("age")}

    Missing fields:

    {state.get("missing_information", [])}

    Latest user message:

    {latest_message.content}

    {instruction}

    Examples:

    Missing fields: ["severity"]
    Message: "7"

    severity = "7"

    Missing fields: ["age"]
    Message: "65"

    age = 65

    STRICT RULES:
    - Symptoms are medical complaints only (e.g. "fever", "chest pain").
    - Do not classify age, severity, or duration as symptoms.
    - Duration must be a clear time expression (e.g. "2 days", "1 week"). If the value is unclear or not a real duration, return null.
    - Severity must be a clear descriptor (e.g. "mild", "moderate", "severe", or a 1-10 number). If unclear, return null.
    - Age must be a positive integer. If unclear, return null.
    - Return null for any field that is absent OR that contains nonsensical/invalid data.
    """
    )

    print(response)


    return {
        "symptoms": list(
            set(
                state.get("symptoms", [])
                + response.symptoms
            )
        ),

        "duration":
            response.duration
            or state.get("duration"),

        "severity":
            response.severity
            or state.get("severity"),

        "age":
            response.age
            or state.get("age")
    }


def missing_information_node(state: TriageState):

    missing = []

    if not state.get("duration"):
        missing.append("duration")

    if not state.get("age"):
        missing.append("age")

    if not state.get("severity"):
        missing.append("severity")

    return {
        "missing_information": missing
    }



def question_generator(state: TriageState):

    structured_llm = llm.with_structured_output(FollowUpQuestions)
    response = structured_llm.invoke(
        f"""
        Given:
        Missing info: {state["missing_information"]}

        Ask concise follow-up questions to gather the missing information.
        """
    )

    user_answer = interrupt(
        {
            "questions": response.questions
        }
    )

    return {
    "messages": [
        {
            "role": "user",
            "content": user_answer
        }
        ]
    }

def red_flag_detector(state: TriageState):

    structured_llm = llm.with_structured_output(RedFlags)

    response = structured_llm.invoke(
        f"""
        Symptoms: {state["symptoms"]}
        Duration: {state["duration"]}
        Age: {state["age"]}
        Severity: {state["severity"]}

        Detect possible red flags present with the patient and output it in the given format.
        """
    )

    print(response)

    return {
        "red_flags": response.red_flags
    }

def urgency_classifier(state: TriageState):

    structured_llm = llm.with_structured_output(UrgencyClassifier)

    response = structured_llm.invoke(
        f"""
        Given the following information:
        Symptoms: {state["symptoms"]}
        Duration: {state["duration"]}
        Age: {state["age"]}
        Severity: {state["severity"]}
        Red Flags: {state["red_flags"]}

        Classify the urgency as "low", "medium", "high". Output it in the given format
        """
    )

    print(response)

    return {
        "urgency": response.urgency,
        "reasoning": response.reasoning
    }


def response_generator(state: TriageState):

    safety_issues = state.get("safety_issues")
    safety_context = f"\nWARNING: Fix the following safety issues from the previous response:\n{safety_issues}\n" if safety_issues else ""

    response = llm.invoke(
        f"""
        Symptoms: {state["symptoms"]}
        Duration: {state["duration"]}
        Age: {state["age"]}
        Severity: {state["severity"]}
        Urgency: {state["urgency"]}
        Reasoning: {state["reasoning"]}
        {safety_context}
        Provide a report involving the urgency, suggested action and reasoning.
        Do not diagnose.
        Do not recommend medications.
        """
    )

    print(response)

    return {
        "final_response": response.content
    }


def human_approval(state: TriageState):

    edits = interrupt(
        {
            "symptoms": state["symptoms"],
            "red_flags": state["red_flags"],
            "urgency": state["urgency"],
            "reasoning": state["reasoning"],
            "response": state["final_response"]
        }
    )

    if edits["approve"]:
        return {
            "review_action": "approve"
        }

    return {
        "urgency": edits["urgency"],
        "review_action": "edited"
    }


# def safety_checker(state: TriageState):
#     structured_llm = llm.with_structured_output(
#         SafetyIssues
#     )

#     response = structured_llm.invoke(
#         f"""
#         Review the following response.

#         Response: {state["final_response"]}

#         Check for:

#         - diagnoses
#         - medication recommendations
#         - unsupported claims

#         Return any safety issues found.
#         """
#     )

#     print(response)

#     return {
#         "safety_issues": response.safety_issues
#     }

def route_information(state: TriageState):
    if len(state["missing_information"]) == 0:
        return "complete"

    return "incomplete"


def route_human_review(state: TriageState):

    if state["review_action"] == "approve":
        return "approved"

    return "edited"


# def route_safety(state: TriageState):

#     if len(state["safety_issues"]) == 0:
#         return "safe"

#     return "unsafe"


graph_builder = StateGraph(TriageState)

graph_builder.add_node("intake_agent", intake_agent)
graph_builder.add_node("symptom_extractor", symptom_extractor)
graph_builder.add_node("missing_information_node", missing_information_node)
graph_builder.add_node("question_generator", question_generator)
graph_builder.add_node("red_flag_detector", red_flag_detector)
graph_builder.add_node("urgency_classifier", urgency_classifier)
graph_builder.add_node("response_generator", response_generator)
# graph_builder.add_node("safety_checker",safety_checker)
graph_builder.add_node("human_approval",human_approval)

graph_builder.add_edge(START, "intake_agent")
graph_builder.add_edge("intake_agent", "symptom_extractor")
graph_builder.add_edge("symptom_extractor", "missing_information_node")

graph_builder.add_conditional_edges(
    "missing_information_node",
    route_information,
    {
        "complete": "red_flag_detector",
        "incomplete": "question_generator"
    }
)

graph_builder.add_edge("question_generator", "symptom_extractor")
graph_builder.add_edge("red_flag_detector", "urgency_classifier")
graph_builder.add_edge("urgency_classifier", "response_generator")
# graph_builder.add_edge("response_generator","safety_checker")

# graph_builder.add_conditional_edges(
#     "safety_checker",
#     route_safety,
#     {
#         "safe": "human_approval",
#         "unsafe": "response_generator"
#     }
# )
graph_builder.add_edge("response_generator", "human_approval")

graph_builder.add_conditional_edges(
    "human_approval",
    route_human_review,
    {
        "approved": END,
        "edited": "response_generator"
    }
)

memory = MemorySaver()

graph = graph_builder.compile( checkpointer = memory)

