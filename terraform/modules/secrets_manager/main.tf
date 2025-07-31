resource "aws_secretsmanager_secret" "main" {
  name = var.secret_name

  description = "Database credentials for ${var.environment} environment"

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "main" {
  secret_id = aws_secretsmanager_secret.main.id

  secret_string = jsonencode({
    DB_USER     = var.db_username
    DB_PASSWORD = var.db_password
    DB_HOST     = var.db_host
    DB_PORT     = var.db_port
    DB_NAME     = var.db_name
  })
} 