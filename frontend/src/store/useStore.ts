import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  userId: number;
  userName: string;
  targetExam: string;
  goalDate: string;
  dailyHours: number;
  isOnboarded: boolean;
  token: string;

  setUserId: (id: number) => void;
  setUserName: (name: string) => void;
  setToken: (token: string) => void;
  setIsOnboarded: (val: boolean) => void;
  setOnboardingData: (data: { targetExam: string; goalDate: string; dailyHours: number }) => void;
  completeOnboarding: () => void;
  logout: () => void;
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
      token: "",

      setUserId: (id) => set({ userId: id }),
      setUserName: (name) => set({ userName: name }),
      setToken: (token) => set({ token }),
      setIsOnboarded: (val) => set({ isOnboarded: val }),
      setOnboardingData: (data) => set({ ...data }),
      completeOnboarding: () => set({ isOnboarded: true }),
      logout: () => set({
        userId: 0,
        userName: "Aspirant",
        targetExam: "",
        goalDate: "",
        dailyHours: 0,
        isOnboarded: false,
        token: ""
      }),
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
  mockType: 'full' | 'unit';
  chapterId?: number;
  questions: any[];

  startTest: (durationMinutes: number, type?: 'full' | 'unit', chapterId?: number) => void;
  endTest: () => void;
  setAnswer: (questionId: number, answer: string) => void;
  setIndex: (index: number) => void;
  setQuestions: (questions: any[]) => void;
  decrementTime: () => void;
  reset: () => void;
}

export const useMockStore = create<MockTestState>()(
  persist(
    (set) => ({
      isActive: false,
      timeLeft: 0,
      currentQuestionIndex: 0,
      answers: {},
      mockType: 'full',
      questions: [],

      startTest: (durationMinutes, type = 'full', chapterId) => set({
        isActive: true,
        timeLeft: durationMinutes * 60,
        currentQuestionIndex: 0,
        answers: {},
        mockType: type,
        chapterId: chapterId,
        questions: []
      }),
      endTest: () => set({ isActive: false, questions: [] }),
      setAnswer: (questionId, answer) => set((state) => ({
        answers: { ...state.answers, [questionId]: answer }
      })),
      setIndex: (index) => set({ currentQuestionIndex: index }),
      setQuestions: (qs) => set({ questions: qs }),
      decrementTime: () => set((state) => ({ timeLeft: Math.max(0, state.timeLeft - 1) })),
      reset: () => set({
        isActive: false,
        timeLeft: 0,
        currentQuestionIndex: 0,
        answers: {},
        mockType: 'full',
        questions: []
      }),
    }),
    {
      name: 'mindleap-mock-storage',
    }
  )
);
