import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  GraduationCap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  X,
  Award,
  BookOpen,
  Check,
} from 'lucide-react';
import { projectApi, QuizQuestion } from '../../services/api/projectApi';
import { Button } from '../ui/Button';

interface ProjectLearningQuizModalProps {
  projectId: string;
  projectTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectLearningQuizModal: React.FC<ProjectLearningQuizModalProps> = ({
  projectId,
  projectTitle,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && projectId) {
      loadQuiz();
    }
  }, [isOpen, projectId]);

  const loadQuiz = async () => {
    setLoading(true);
    setError(null);
    setUserAnswers({});
    setIsSubmitted(false);
    setCurrentIdx(0);
    try {
      const data = await projectApi.getLearningQuiz(projectId);
      setQuestions(data.questions || []);
    } catch (err: any) {
      console.error('Failed to load project learning quiz:', err);
      setError(err?.response?.data?.detail || 'Could not generate quiz questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSelectOption = (optionIndex: number) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentIdx]: optionIndex,
    }));
  };

  const answeredCount = Object.keys(userAnswers).length;
  const isAllAnswered = questions.length > 0 && answeredCount === questions.length;

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correct_option_index) {
        score += 1;
      }
    });
    return score;
  };

  const score = calculateScore();
  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  const currentQuestion = questions[currentIdx];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-surface rounded-2xl border border-borderPaper shadow-elevated w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-borderPaper bg-paper/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
              <GraduationCap size={22} />
            </div>
            <div>
              <h2 className="font-heading text-lg sm:text-xl font-bold text-primary">
                What did you learn from your build?
              </h2>
              <p className="text-xs text-secondary truncate max-w-md">
                AI Mastery Assessment • 8 Advanced Questions for "{projectTitle}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-primary rounded-lg hover:bg-paper transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center mb-4 border border-orange-500/20 animate-pulse">
                <Sparkles size={28} className="animate-spin" />
              </div>
              <h3 className="font-heading text-base font-semibold text-primary mb-1">
                Formulating Deep Assessment Questions
              </h3>
              <p className="text-xs text-secondary max-w-sm">
                AI Examiner is analyzing your project architecture, edge cases, and internals to create 8 challenging MCQs...
              </p>
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <AlertCircle size={36} className="mx-auto text-red-500 mb-2" />
              <p className="text-sm font-semibold text-primary mb-2">{error}</p>
              <Button variant="secondary" size="sm" onClick={loadQuiz}>
                <RotateCcw size={14} className="mr-1" /> Retry
              </Button>
            </div>
          ) : !isSubmitted ? (
            <div>
              {/* Question progress pill bar */}
              <div className="flex items-center justify-between mb-4 gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {questions.map((q, idx) => {
                    const isSelected = userAnswers[idx] !== undefined;
                    const isCurrent = idx === currentIdx;
                    return (
                      <button
                        key={q.id || idx}
                        onClick={() => setCurrentIdx(idx)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                          isCurrent
                            ? 'bg-orange-500 text-white ring-2 ring-orange-500/30'
                            : isSelected
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-paper text-secondary hover:bg-paper/80 border border-borderPaper'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs font-medium text-secondary">
                  <span className="font-semibold text-primary">{answeredCount}</span> of {questions.length} answered
                </div>
              </div>

              {/* Current Question Card */}
              {currentQuestion && (
                <div className="bg-paper rounded-xl p-5 border border-borderPaper mb-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                      Question {currentIdx + 1} of {questions.length}
                    </span>
                    {currentQuestion.concept_tested && (
                      <span className="text-xs font-medium text-muted">
                        • {currentQuestion.concept_tested}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-semibold text-primary leading-relaxed mb-4">
                    {currentQuestion.question}
                  </h3>

                  {/* 4 MCQ Options */}
                  <div className="space-y-2.5">
                    {currentQuestion.options.map((option, optIdx) => {
                      const isOptionSelected = userAnswers[currentIdx] === optIdx;
                      const letter = String.fromCharCode(65 + optIdx);
                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectOption(optIdx)}
                          className={`w-full text-left p-3 sm:p-3.5 rounded-xl text-xs sm:text-sm transition-all flex items-start gap-3 border ${
                            isOptionSelected
                              ? 'bg-orange-500/10 border-orange-500 text-primary font-medium ring-1 ring-orange-500/30 dark:bg-orange-950/40'
                              : 'bg-surface hover:bg-paper/80 border-borderPaper text-secondary hover:text-primary'
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isOptionSelected
                                ? 'bg-orange-500 text-white'
                                : 'bg-paper text-muted border border-borderPaper'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="flex-1 leading-relaxed">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                  disabled={currentIdx === 0}
                >
                  <ChevronLeft size={14} className="mr-1" /> Previous
                </Button>

                {currentIdx < questions.length - 1 ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                  >
                    Next <ChevronRight size={14} className="ml-1" />
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsSubmitted(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white border-none"
                    disabled={answeredCount < questions.length}
                  >
                    <Check size={14} className="mr-1" /> Submit Assessment
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* Results Screen */
            <div className="space-y-6">
              {/* Score Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 text-center">
                <div className="w-16 h-16 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 mx-auto flex items-center justify-center mb-3">
                  <Award size={32} />
                </div>
                <h3 className="font-heading text-xl sm:text-2xl font-bold text-primary mb-1">
                  {score} / {questions.length} Correct ({percentage}%)
                </h3>
                <p className="text-xs sm:text-sm text-secondary max-w-md mx-auto mb-3">
                  {percentage >= 75
                    ? 'Outstanding! You demonstrated mastery of the architecture and edge cases in this build.'
                    : percentage >= 50
                    ? 'Good effort! You grasp core concepts, but reviewing key architecture tradeoffs will level up your craft.'
                    : 'Review Recommended: Inspect the explanations below to master the architectural nuances of this project.'}
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-paper border border-borderPaper text-primary">
                  <span>Targeted Skill Retention Verified</span>
                </div>
              </div>

              {/* Detailed Breakdown of 8 Questions */}
              <div>
                <h4 className="font-heading text-sm font-bold text-primary mb-3 flex items-center gap-2">
                  <BookOpen size={16} className="text-orange-500" />
                  <span>Comprehensive Answers & Technical Explanations</span>
                </h4>

                <div className="space-y-4">
                  {questions.map((q, idx) => {
                    const userAns = userAnswers[idx];
                    const isCorrect = userAns === q.correct_option_index;
                    return (
                      <div
                        key={q.id || idx}
                        className={`p-4 rounded-xl border ${
                          isCorrect
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-red-500/5 border-red-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {isCorrect ? (
                              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                            ) : (
                              <XCircle size={16} className="text-red-500 flex-shrink-0" />
                            )}
                            <span className="text-xs font-bold text-primary">
                              Question {idx + 1}: {q.concept_tested}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isCorrect
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                            }`}
                          >
                            {isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-primary font-medium mb-3">
                          {q.question}
                        </p>

                        {/* Options summary */}
                        <div className="space-y-1.5 mb-3 text-xs">
                          {q.options.map((opt, optIdx) => {
                            const isThisCorrect = optIdx === q.correct_option_index;
                            const isThisUser = optIdx === userAns;
                            return (
                              <div
                                key={optIdx}
                                className={`p-2 rounded-lg flex items-center gap-2 ${
                                  isThisCorrect
                                    ? 'bg-emerald-500/15 text-emerald-950 dark:text-emerald-200 font-semibold'
                                    : isThisUser
                                    ? 'bg-red-500/15 text-red-950 dark:text-red-200 line-through'
                                    : 'text-secondary'
                                }`}
                              >
                                <span className="font-mono text-[10px]">{String.fromCharCode(65 + optIdx)}.</span>
                                <span>{opt}</span>
                                {isThisCorrect && <span className="ml-auto text-[10px] uppercase font-bold text-emerald-600">✓ Correct</span>}
                                {isThisUser && !isThisCorrect && <span className="ml-auto text-[10px] uppercase font-bold text-red-600">Your Answer</span>}
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="p-3 rounded-lg bg-paper border border-borderPaper text-xs text-secondary leading-relaxed">
                            <span className="font-semibold text-primary block mb-0.5">
                              💡 Technical Breakdown:
                            </span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="secondary" size="sm" onClick={loadQuiz}>
                  <RotateCcw size={14} className="mr-1" /> Retake Assessment
                </Button>
                <Button variant="primary" size="sm" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
