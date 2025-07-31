variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "github_repository" {
  description = "GitHub repository name (format: owner/repo)"
  type        = string
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
} 