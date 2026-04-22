import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  userId: number;
  userName: string;
  targetExam: string;
  goalDate: string;
  dailyHours: number;
  isOnboarded: boolean;
  
  setUserId: (id: number) => void;
  setUserName: (name: string) => void;
  setOnboardingData: (data: { targetExam: string; goalDate: string; dailyHours: number }) => void;
  completeOnboarding: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userId: 1,
      userName: "Aspirant",
      targetExam: "",
      goalDate: "",
      dailyHours: 0,
      isOnboarded: false,

      setUserId: (id) => set({ userId: id }),
      setUserName: (name) => set({ userName: name }),
      setOnboardingData: (data) => set({ ...data }),
      completeOnboarding: () => set({ isOnboarded: true }),
    }),
    {
      name: 'mindleap-user-storage',
    }
  )
);

interface MockTestState {
  isActive: boolean;
  timeLeft: number; // in seconds
  currentQuestionIndex: number;
  answers: Record<number, string>;
  
  startTest: (durationMinutes: number) => void;
  endTest: () => void;
  setAnswer: (questionId: number, answer: string) => void;
  setIndex: (index: number) => void;
  decrementTime: () => void;
}

export const useMockStore = create<MockTestState>((set) => ({
  isActive: false,
  timeLeft: 0,
  currentQuestionIndex: 0,
  answers: {},

  startTest: (durationMinutes) => set({ 
    isActive: true, 
    timeLeft: durationMinutes * 60,
    currentQuestionIndex: 0,
    answers: {}
  }),
  endTest: () => set({ isActive: false }),
  setAnswer: (questionId, answer) => set((state) => ({
    answers: { ...state.answers, [questionId]: answer }
  })),
  setIndex: (index) => set({ currentQuestionIndex: index }),
  decrementTime: () => set((state) => ({ timeLeft: Math.max(0, state.timeLeft - 1) })),
}));
