from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent import graph
from langgraph.types import Command

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    thread_id: str
    message: str | None = None
    resume: dict | str | None = None

@app.post("/chat")
def chat(request: ChatRequest):
    config = {"configurable": {"thread_id": request.thread_id}}
    
    # If resuming from an interrupt
    if request.resume is not None:
        result = graph.invoke(Command(resume=request.resume), config=config)
    elif request.message:
        result = graph.invoke({"messages": [{"role": "user", "content": request.message}]}, config=config)
    else:
        return {"error": "Must provide message or resume data"}
        
    state = graph.get_state(config)
    interrupts = state.interrupts
    
    return {
        "state": state.values,
        "interrupts": [i.value for i in interrupts]
    }

@app.get("/state/{thread_id}")
def get_state(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    state = graph.get_state(config)
    return {
        "state": state.values,
        "interrupts": [i.value for i in state.interrupts]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
