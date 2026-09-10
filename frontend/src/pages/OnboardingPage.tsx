import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { authApi } from '../services/api/authApi';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

const INTEREST_OPTIONS = [
  'AI / Machine Learning',
  'Web Development',
  'Mobile Development',
  'Data Science',
  'Robotics',
  'Cybersecurity',
  'Automation',
  'Game Development',
  'UI/UX',
  'Startups',
  'Other',
];

const EXPERIENCE_OPTIONS = [
  { value: 'Beginner', description: 'Just starting out or exploring new concepts' },
  { value: 'Intermediate', description: 'Building projects and refining core skills' },
  { value: 'Advanced', description: 'Experienced builder tackling complex systems' },
];

const GOAL_OPTIONS = [
  'Learn',
  'Discover project ideas',
  'Build projects',
  'Discover new technology',
  'Improve my skills',
];

export const OnboardingPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<number>(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user?.interests || []);
  const [selectedExperience, setSelectedExperience] = useState<string>(user?.experience_level || '');
  const [selectedGoals, setSelectedGoals] = useState<string[]>(user?.goals || []);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (selectedInterests.length === 0) {
        setError('Please select at least one interest to continue.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedExperience) {
        setError('Please select your experience level.');
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (selectedGoals.length === 0) {
      setError('Please select at least one goal.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedUser = await authApi.completeOnboarding({
        interests: selectedInterests,
        experience_level: selectedExperience,
        goals: selectedGoals,
      });
      updateUser(updatedUser);
      setIsComplete(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save onboarding preferences. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper text-primary transition-colors duration-200">
      {/* Top Header Wordmark */}
      <header className="py-6 px-8 border-b border-borderPaper bg-paper">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="font-heading text-2xl font-bold tracking-tight text-primary">
            BuildFeed<span className="text-accent">.</span>
          </span>
          {!isComplete && (
            <div className="flex items-center gap-2 text-xs font-medium text-secondary">
              <span>Step {step} of 3</span>
              <div className="w-24 h-1.5 bg-surface border border-borderPaper rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300 ease-out"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          {isComplete ? (
            /* Final Success Screen */
            <div className="editorial-card p-10 text-center animate-fade-in-up">
              <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950/40 border border-accent/30 flex items-center justify-center mx-auto mb-6 text-accent">
                <Sparkles size={32} />
              </div>
              <h1 className="font-heading text-3xl font-bold text-primary mb-3">
                Your BuildFeed is ready.
              </h1>
              <p className="text-secondary text-base leading-relaxed mb-8 max-w-md mx-auto">
                We've customized your experience based on your building interests and goals.
              </p>
              <Button
                variant="accent"
                className="w-full sm:w-auto px-8 !py-3 text-base font-semibold"
                onClick={handleFinish}
              >
                Go to My Dashboard
                <ArrowRight size={18} className="ml-2" />
              </Button>
            </div>
          ) : (
            /* Onboarding Wizard Steps */
            <div className="editorial-card p-8 sm:p-10 animate-fade-in-up">
              {error && (
                <Alert
                  type="error"
                  message={error}
                  className="mb-6"
                />
              )}

              {/* Step 1: Interests */}
              {step === 1 && (
                <div>
                  <h1 className="font-heading text-2xl sm:text-3xl font-bold text-primary mb-2">
                    What are you interested in building?
                  </h1>
                  <p className="text-secondary text-sm mb-6">
                    Select all topic areas that match your building interests.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                    {INTEREST_OPTIONS.map((interest) => {
                      const isSelected = selectedInterests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => toggleInterest(interest)}
                          className={`flex items-center justify-between p-3.5 rounded-md border text-sm font-medium text-left transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? 'bg-accent/10 border-accent text-accent dark:bg-accent/20'
                              : 'bg-surface border-borderPaper text-primary hover:border-cardHoverBorder hover:bg-paper'
                          }`}
                        >
                          <span>{interest}</span>
                          {isSelected && <Check size={16} className="text-accent flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 2: Experience */}
              {step === 2 && (
                <div>
                  <h1 className="font-heading text-2xl sm:text-3xl font-bold text-primary mb-2">
                    What's your experience level?
                  </h1>
                  <p className="text-secondary text-sm mb-6">
                    Choose the level that best describes your technical background.
                  </p>

                  <div className="space-y-3 mb-8">
                    {EXPERIENCE_OPTIONS.map((exp) => {
                      const isSelected = selectedExperience === exp.value;
                      return (
                        <button
                          key={exp.value}
                          type="button"
                          onClick={() => setSelectedExperience(exp.value)}
                          className={`w-full flex items-start justify-between p-4 rounded-md border text-left transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? 'bg-accent/10 border-accent text-accent dark:bg-accent/20'
                              : 'bg-surface border-borderPaper text-primary hover:border-cardHoverBorder hover:bg-paper'
                          }`}
                        >
                          <div>
                            <div className={`font-semibold text-base mb-0.5 ${isSelected ? 'text-accent' : 'text-primary'}`}>
                              {exp.value}
                            </div>
                            <div className="text-xs text-secondary">{exp.description}</div>
                          </div>
                          {isSelected && <Check size={18} className="text-accent flex-shrink-0 mt-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Goals */}
              {step === 3 && (
                <div>
                  <h1 className="font-heading text-2xl sm:text-3xl font-bold text-primary mb-2">
                    What do you want BuildFeed to help you do?
                  </h1>
                  <p className="text-secondary text-sm mb-6">
                    Select your primary objectives for using the platform.
                  </p>

                  <div className="space-y-3 mb-8">
                    {GOAL_OPTIONS.map((goal) => {
                      const isSelected = selectedGoals.includes(goal);
                      return (
                        <button
                          key={goal}
                          type="button"
                          onClick={() => toggleGoal(goal)}
                          className={`w-full flex items-center justify-between p-4 rounded-md border text-sm font-medium text-left transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? 'bg-accent/10 border-accent text-accent dark:bg-accent/20'
                              : 'bg-surface border-borderPaper text-primary hover:border-cardHoverBorder hover:bg-paper'
                          }`}
                        >
                          <span>{goal}</span>
                          {isSelected && <Check size={18} className="text-accent flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-borderPaper">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    <ArrowLeft size={16} className="mr-1.5" />
                    Back
                  </Button>
                ) : (
                  <div />
                )}

                {step < 3 ? (
                  <Button
                    type="button"
                    variant="accent"
                    onClick={handleNext}
                  >
                    Next
                    <ArrowRight size={16} className="ml-1.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="accent"
                    onClick={handleSubmit}
                    isLoading={isSubmitting}
                  >
                    Complete Onboarding
                    <Sparkles size={16} className="ml-1.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
