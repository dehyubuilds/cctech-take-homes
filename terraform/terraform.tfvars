aws_region = "us-east-1"
environment = "prod"

vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]
public_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24"]

ecr_repository_name = "devsecops-app"
db_instance_class = "db.t3.micro"
db_allocated_storage = 20
db_engine_version = "15.13"
db_secret_name = "devsecops-db-creds"
db_username = "appuser"
db_password = "changeme123!"

ecs_cluster_name = "devsecops-cluster"
ecs_task_family = "devsecops-task"
ecs_task_cpu = 512
ecs_task_memory = 1024
container_name = "devsecops-app"
container_port = 3000
ecs_service_name = "devsecops-service"
ecs_service_desired_count = 1

tags = {
  Project     = "DevSecOpsChallenge"
  Environment = "prod"
  ManagedBy   = "terraform"
} 