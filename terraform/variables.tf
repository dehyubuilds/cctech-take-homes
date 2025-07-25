variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "ecr_repository_name" {
  description = "Name of the ECR repository"
  type        = string
  default     = "devsecops-app"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.13"
}

variable "db_secret_name" {
  description = "Name of the Secrets Manager secret"
  type        = string
  default     = "devsecops-db-creds"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "appuser"
}

variable "db_password" {
  description = "Database password"
  type        = string
  default     = "changeme123!"
  sensitive   = true
}

variable "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
  default     = "devsecops-cluster"
}

variable "ecs_task_family" {
  description = "ECS task family name"
  type        = string
  default     = "devsecops-task"
}

variable "ecs_task_cpu" {
  description = "ECS task CPU units"
  type        = number
  default     = 512
}

variable "ecs_task_memory" {
  description = "ECS task memory in MB"
  type        = number
  default     = 1024
}

variable "container_name" {
  description = "Container name"
  type        = string
  default     = "devsecops-app"
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 3000
}

variable "container_environment" {
  description = "Container environment variables"
  type        = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "ecs_service_name" {
  description = "ECS service name"
  type        = string
  default     = "devsecops-service"
}

variable "ecs_service_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "DevSecOpsChallenge"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
} 