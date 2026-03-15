import { config } from "@/lib/config";
import { getMockUserRepository as _getMockUserRepository } from "./mock-user-repository";
import { getMockAppRepository as _getMockAppRepository } from "./mock-app-repository";
import { getMockSubscriptionRepository as _getMockSubscriptionRepository } from "./mock-subscription-repository";
import { getDynamoUserRepository } from "./dynamo-user-repository";
import { getDynamoAppRepository } from "./dynamo-app-repository";
import { getDynamoSubscriptionRepository } from "./dynamo-subscription-repository";

export { getMockUserRepository } from "./mock-user-repository";
export { getMockAppRepository } from "./mock-app-repository";
export { getMockSubscriptionRepository } from "./mock-subscription-repository";

/** User repository: DynamoDB when configured, else in-memory mock. */
export function getUserRepository() {
  return config.dynamo.useReal ? getDynamoUserRepository() : _getMockUserRepository();
}

/** App repository: DynamoDB when configured, else in-memory mock. */
export function getAppRepository() {
  return config.dynamo.useReal ? getDynamoAppRepository() : _getMockAppRepository();
}

/** Subscription repository: DynamoDB when configured, else in-memory mock. */
export function getSubscriptionRepository() {
  return config.dynamo.useReal ? getDynamoSubscriptionRepository() : _getMockSubscriptionRepository();
}
