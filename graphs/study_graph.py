from typing import TypedDict, List, Annotated
import operator
from langgraph.graph import StateGraph, END
from sqlalchemy.orm import Session
from db.database import SessionLocal
from db import models
from agents.performance_analyst import PerformanceAnalyst
from agents.strategy_agent import StrategyAgent
from agents.discipline_coach import DisciplineCoach

class StudyState(TypedDict):
    user_id: int
    chapter_id: int
    latest_status: str # 'correct', 'incorrect'
    signals: Annotated[List[str], operator.add]
    next_action: str

# --- Nodes ---

def analyst_node(state: StudyState):
    print("Graph: Running Analyst Node...")
    db = SessionLocal()
    try:
        analyst = PerformanceAnalyst(db)
        analyst.analyze_user_progress(state['user_id'], state['chapter_id'])
        
        # Check if a weakness signal was published to DB
        latest_signal = db.query(models.AgentSignal).filter(
            models.AgentSignal.user_id == state['user_id'],
            models.AgentSignal.signal_type == "WEAK_TOPIC_DETECTED",
            models.AgentSignal.status == "PENDING"
        ).order_by(models.AgentSignal.id.desc()).first()
        
        signals = []
        next_action = "coach"
        if latest_signal:
            signals.append("WEAKNESS")
            next_action = "strategy"
        
        return {"signals": signals, "next_action": next_action}
    finally:
        db.close()

def strategy_node(state: StudyState):
    print("Graph: Running Strategy Node...")
    db = SessionLocal()
    try:
        strategy = StrategyAgent(db)
        # In a real graph, we'd pass signals. Here we just react to the detection.
        strategy.respond_to_weakness(state['user_id'], state['chapter_id'], 0.0)
        return {"signals": ["PLAN_ADJUSTED"], "next_action": "coach"}
    finally:
        db.close()

def coach_node(state: StudyState):
    print("Graph: Running Coach Node...")
    db = SessionLocal()
    try:
        coach = DisciplineCoach(db)
        coach.generate_daily_nudge(state['user_id'])
        return {"next_action": "end"}
    finally:
        db.close()

# --- Router ---

def router(state: StudyState):
    return state["next_action"]

# --- Construction ---

builder = StateGraph(StudyState)

builder.add_node("analyst", analyst_node)
builder.add_node("strategy", strategy_node)
builder.add_node("coach", coach_node)

builder.set_entry_point("analyst")

builder.add_conditional_edges(
    "analyst",
    router,
    {
        "strategy": "strategy",
        "coach": "coach"
    }
)

builder.add_edge("strategy", "coach")
builder.add_edge("coach", END)

study_graph = builder.compile()
