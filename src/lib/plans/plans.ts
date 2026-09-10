import { SubscriptionPlan } from "@prisma/client";

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  priceMonthly: number;
  tagline: string;
  features: string[];
  limits: {
    maxUsers: number | "unlimited";
    projects: boolean;
    timeTracking: boolean;
    aiAssistant: boolean;
    advancedReporting: boolean;
    accountantAccess: boolean;
    advancedForecasting: boolean;
    exports: boolean;
  };
}

export const PLANS: Record<SubscriptionPlan, PlanDefinition> = {
  SOLO: {
    id: "SOLO",
    name: "Solo",
    priceMonthly: 19,
    tagline: "For independent operators.",
    features: [
      "1 user",
      "Invoices & payments",
      "Expense tracking",
      "Basic dashboard",
      "Tax planning estimates",
    ],
    limits: {
      maxUsers: 1,
      projects: true,
      timeTracking: false,
      aiAssistant: false,
      advancedReporting: false,
      accountantAccess: false,
      advancedForecasting: false,
      exports: true,
    },
  },
  TEAM: {
    id: "TEAM",
    name: "Team",
    priceMonthly: 39,
    tagline: "For small teams that bill clients.",
    features: [
      "Multiple users",
      "Projects & time tracking",
      "AI financial assistant",
      "Advanced reporting",
      "Everything in Solo",
    ],
    limits: {
      maxUsers: 5,
      projects: true,
      timeTracking: true,
      aiAssistant: true,
      advancedReporting: true,
      accountantAccess: false,
      advancedForecasting: false,
      exports: true,
    },
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceMonthly: 79,
    tagline: "For growing service businesses.",
    features: [
      "Accountant access role",
      "Advanced forecasting",
      "All exports & integrations",
      "Priority support",
      "Everything in Team",
    ],
    limits: {
      maxUsers: "unlimited",
      projects: true,
      timeTracking: true,
      aiAssistant: true,
      advancedReporting: true,
      accountantAccess: true,
      advancedForecasting: true,
      exports: true,
    },
  },
};

export function getPlan(plan: SubscriptionPlan): PlanDefinition {
  return PLANS[plan];
}
