# CloudWatch Log Group for ECS tasks
resource "aws_cloudwatch_log_group" "ecs_logs" {
  name              = "/ecs/${var.task_family}"
  retention_in_days = 7
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = var.cluster_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

# ECS Task Definition
resource "aws_ecs_task_definition" "main" {
  family                   = var.task_family
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name  = var.container_name
      image = var.container_image

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = var.container_environment

      secrets = [
        {
          name      = "DB_USER"
          valueFrom = "${var.db_secret_arn}:DB_USER::"
        },
        {
          name      = "DB_PASSWORD"
          valueFrom = "${var.db_secret_arn}:DB_PASSWORD::"
        },
        {
          name      = "DB_HOST"
          valueFrom = "${var.db_secret_arn}:DB_HOST::"
        },
        {
          name      = "DB_PORT"
          valueFrom = "${var.db_secret_arn}:DB_PORT::"
        },
        {
          name      = "DB_NAME"
          valueFrom = "${var.db_secret_arn}:DB_NAME::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awlogs-group         = aws_cloudwatch_log_group.ecs_logs.name
          awlogs-region        = var.aws_region
          awlogs-stream-prefix = "ecs"
        }
      }

      essential = true
    }
  ])

  tags = var.tags
}

# ECS Service
resource "aws_ecs_service" "main" {
  name            = var.service_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = var.service_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = var.security_group_ids
    subnets          = var.subnet_ids
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.container_name
    container_port   = var.container_port
  }

  depends_on = [var.target_group_arn]

  tags = var.tags
} 