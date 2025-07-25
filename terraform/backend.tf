terraform {
  backend "s3" {
    bucket         = "devsecops-terraform-state-142770202579"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "devsecops-terraform-locks"
    encrypt        = true
  }
} 