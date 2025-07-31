terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"
  
  vpc_cidr             = var.vpc_cidr
  environment          = var.environment
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  tags                 = var.tags
}

# Security Groups Module
module "security_groups" {
  source = "./modules/sg"
  
  vpc_id      = module.vpc.vpc_id
  environment = var.environment
  tags        = var.tags
}

# IAM Module
module "iam" {
  source = "./modules/iam"
  
  environment      = var.environment
  aws_region       = var.aws_region
  github_repository = "your-username/cctech-take-homes"  # Update this with your actual repo
  tags             = var.tags
}

# ECR Module
module "ecr" {
  source = "./modules/ecr"
  
  repository_name = var.ecr_repository_name
  environment     = var.environment
  tags            = var.tags
}

# RDS Module
module "rds" {
  source = "./modules/rds"
  
  vpc_id                    = module.vpc.vpc_id
  private_subnet_ids        = module.vpc.private_subnet_ids
  db_security_group_id      = module.security_groups.rds_security_group_id
  environment              = var.environment
  db_instance_class        = var.db_instance_class
  db_allocated_storage     = var.db_allocated_storage
  db_engine_version        = var.db_engine_version
  tags                     = var.tags
}

# Secrets Manager Module
module "secrets_manager" {
  source = "./modules/secrets_manager"
  
  secret_name   = var.db_secret_name
  db_host       = module.rds.db_endpoint
  db_port       = module.rds.db_port
  db_name       = module.rds.db_name
  db_username   = var.db_username
  db_password   = var.db_password
  environment   = var.environment
  tags          = var.tags
}

# ALB Module
module "alb" {
  source = "./modules/alb"
  
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  alb_security_group_id = module.security_groups.alb_security_group_id
  environment        = var.environment
  tags               = var.tags
}

# ECS Module
module "ecs" {
  source = "./modules/ecs"
  
  cluster_name         = var.ecs_cluster_name
  task_family          = var.ecs_task_family
  task_cpu             = var.ecs_task_cpu
  task_memory          = var.ecs_task_memory
  execution_role_arn   = module.iam.ecs_execution_role_arn
  task_role_arn        = module.iam.ecs_task_role_arn
  container_name       = var.container_name
  container_image      = "${module.ecr.repository_url}:latest"
  container_port       = var.container_port
  container_environment = var.container_environment
  db_secret_arn        = module.secrets_manager.secret_arn
  aws_region           = var.aws_region
  service_name         = var.ecs_service_name
  service_desired_count = var.ecs_service_desired_count
  security_group_ids   = [module.security_groups.ecs_security_group_id]
  subnet_ids           = module.vpc.private_subnet_ids
  target_group_arn     = module.alb.target_group_arn
  tags                 = var.tags
} 