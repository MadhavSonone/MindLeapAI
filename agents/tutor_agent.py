from langchain_groq import ChatGroq
from sqlalchemy.orm import Session
from db import models
from config import settings
from services.rag_service import rag_service
import json

class TutorAgent:
    def __init__(self, db: Session):
        self.db = db
        self.llm = ChatGroq(
            temperature=0, 
            groq_api_key=settings.GROQ_API_KEY, 
            model_name="llama-3.1-8b-instant"
        )

    def explain_question(self, question_id: int, user_id: int, adaptive_level: str = "beginner"):
        """Solves a question and provides a conceptual explanation."""
        print(f"Tutor: Explaining Question {question_id} at {adaptive_level} level...")
        
        question = self.db.query(models.Question).filter(models.Question.id == question_id).first()
        if not question:
            return "Question not found."

        options = self.db.query(models.Option).filter(models.Option.question_id == question_id).all()
        options_text = "\n".join([f"{i+1}. {opt.content}" for i, opt in enumerate(options)])

        prompt = f"""
        You are a JEE Tutor. Your goal is to solve the following question and explain the core concept.
        
        Question: {question.content}
        Options:
        {options_text}

        Level: {adaptive_level}

        Format your response as follows:
        1. Correct Option Index (1-based)
        2. Steps to Solve
        3. Core Concept Explanation

        Respond in a clear, encouraging tone.
        """
        
        try:
            from schemas import SolvedQuestionOutput
            import datetime
            structured_llm = self.llm.with_structured_output(SolvedQuestionOutput)
            result = structured_llm.invoke(prompt)
            
            explanation_summary = f"""
            **Correct Option**: {result.correct_option_index}
            
            **Steps**:
            {chr(10).join(['- ' + s for s in result.steps])}
            
            **Concept**: {result.core_concept}
            
            {result.explanation_summary}
            """
            
            # Log the interaction
            interaction = models.AgentInteraction(
                user_id=user_id,
                agent_role="Tutor",
                input_query=f"Explain Question {question_id}",
                output_response=explanation_summary,
                timestamp=datetime.datetime.now().isoformat()
            )
            self.db.add(interaction)
            self.db.commit()
            
            return explanation_summary
        except Exception as e:
            print(f"Tutor: Error explaining question: {e}")
            return "Error explaining question."

    def chat_vault(self, user_id: int, query: str):
        """Answers queries based on the user's custom context using RAG."""
        print(f"Tutor: Answering Vault query for User {user_id} using RAG...")
        
        # Fetch context from RAG store
        context = rag_service.query(user_id, query)

        prompt = f"""
        CONTEXT FROM YOUR VAULT DOCUMENTS:
        {context if context else "No specific documents found in vault related to this query."}
        
        USER QUERY: {query}
        
        CRITICAL INSTRUCTION:
        1. If relevant information is in the CONTEXT above, PRIORITIZE it over general knowledge.
        2. If you are using general knowledge because context is missing, explicitly state: "Based on general academic patterns (not found in your vault)..."
        3. Keep the explanation concise and exam-focused.
        """
        
        try:
            response = self.llm.invoke(prompt)
            return response.content
        except Exception as e:
            print(f"Tutor: Error in Vault chat: {e}")
            return "Error processing vault query."
