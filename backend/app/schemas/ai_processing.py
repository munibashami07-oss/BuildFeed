from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class AIAnalysisResult(BaseModel):
    short_summary: str = Field(..., description="A concise 2-3 sentence summary of the content.")
    topics: List[str] = Field(default_factory=list, description="Relevant topic areas (e.g. AI/ML, Web Dev, Robotics).")
    technologies: List[str] = Field(default_factory=list, description="Specific frameworks, languages, or tools mentioned (e.g. PyTorch, React, Python).")
    skills: List[str] = Field(default_factory=list, description="Key builder skills demonstrated or taught (e.g. Model Training, API Design).")
    difficulty_level: str = Field("Intermediate", description="Beginner, Intermediate, or Advanced.")
    content_category: str = Field("AI/ML", description="Primary category: AI/ML, Web Development, Data Science, Robotics, Cybersecurity, Automation, Research, AI Tools, etc.")
    project_potential: str = Field(..., description="Suggestions or score on how a builder can apply this in a project.")
    learning_value: str = Field(..., description="Key takeaways and educational value for a builder.")
    builder_relevance: str = Field("Medium", description="High, Medium, or Low — how useful this is for someone who wants to learn, build, or implement technology.")
    relevance_score: int = Field(50, description="0-100 relevance score for technical builders. 80-100=essential, 60-79=useful, 40-59=marginal, 0-39=low value.")


class ProcessingBatchResponse(BaseModel):
    total_items: int
    completed: int
    failed: int
    errors: List[str] = []


class ProcessingStatusSummary(BaseModel):
    discovered: int
    processing: int
    completed: int
    failed: int
    total: int
