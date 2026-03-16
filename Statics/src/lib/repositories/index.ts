import { getDynamoUserRepository } from "./dynamo-user-repository";
import { getDynamoAppRepository } from "./dynamo-app-repository";
import { getDynamoSubscriptionRepository } from "./dynamo-subscription-repository";

/** Real only: DynamoDB for all data. No mocks. */
export function getUserRepository() {
  return getDynamoUserRepository();
}

export function getAppRepository() {
  return getDynamoAppRepository();
}

export function getSubscriptionRepository() {
  return getDynamoSubscriptionRepository();
}
