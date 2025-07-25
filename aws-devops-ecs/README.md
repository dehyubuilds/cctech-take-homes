# DevSecOps Engineer Assessment: Containerized Next.js Application with RDS

## Project Setup (Added by Dehyu)

This repository is for the CC Tech DevSecOps challenge. The provided Next.js application is located in `/app` and should not be modified except for deployment configuration (e.g., environment variables). All infrastructure-as-code (Terraform) and CI/CD pipeline code will be added under `/terraform` and `/.github/workflows` respectively. Please follow the instructions below to complete the challenge.

## Overview
This assessment evaluates your DevSecOps skills, focusing on infrastructure as code, containerization, database integration, security implementation, and CI/CD pipeline setup. You'll deploy a provided Next.js application in a secure, scalable containerized architecture using Terraform and AWS services, including RDS PostgreSQL integration.

## Challenge Requirements
1. Use Terraform for all infrastructure provisioning
2. Deploy the provided Next.js application on AWS ECS (Elastic Container Service) with Fargate launch type
3. Use AWS ECR (Elastic Container Registry) for storing the application's Docker image
4. Set up an RDS instance running PostgreSQL and integrate it with the application
5. Implement AWS Secrets Manager for secure credential management
6. Set up a CI/CD pipeline using GitHub Actions (This does NOT need to be in Terraform)

## Provided Resources
- A GitHub repository containing a simple Next.js application with:
  * A pre-configured Dockerfile
  * Sample environment variable configuration for database connection
  * Basic database query functionality to demonstrate connectivity

## Functionality to Implement

### 1. Networking (using Terraform)
- Create a VPC with two public and two private subnets across two availability zones
- Set up an Internet Gateway and NAT Gateways for internet connectivity
- Configure appropriate route tables

### 2. Compute and Containers (using Terraform)
- Create an ECS cluster using Fargate launch type
- Set up an ECR repository for the application image

### 3. Database Setup (using Terraform)
- Provision an RDS instance running PostgreSQL in the private subnets
- Configure appropriate security groups to allow traffic only from the application's security group
- Use AWS Secrets Manager to store the database credentials

### 4. Application Deployment and Database Integration
- Push the provided application's Docker image to ECR
- Create an ECS task definition and service to run the application
- Configure the ECS task to use environment variables for database connection, retrieving credentials from AWS Secrets Manager
- Ensure the application can successfully connect to the RDS instance
- Make the application accessible through an Application Load Balancer on port 80

### 5. Security Implementation
- Implement IAM roles following the principle of least privilege
- Secure all network traffic using appropriate security groups
- Ensure secure transmission of database credentials from Secrets Manager to the application

### 6. CI/CD Pipeline (Optional)
Set up a GitHub Actions workflow with the following stages:
a. Trigger: On push to the main branch
b. Build and Push: 
   - Build the Docker image
   - Push the image to ECR
c. Deploy: 
   - Update the ECS task definition
   - Trigger an ECS service update

## Project Structure
Organize your repository as follows:
- `/terraform`: Terraform configuration files
- `/app`: The provided Next.js application code (including Dockerfile)
- `/.github/workflows`: GitHub Actions workflow files
- `README.md`: Project documentation

## Important Notes
- Ensure your Terraform code is modular and follows best practices
- Follow the principle of least privilege for all IAM roles and policies
- Be prepared to explain each component of your solution and how they work together
- Follow the principle of least privilege for all IAM roles and policies
- Provide clear comments in your code and comprehensive documentation in your README.md

## Submission Instructions
- Create a new GitHub repository for this project
- Ensure all your code is committed to your GitHub repository
- Provide clear instructions in your README.md on how to deploy your solution
- Email the following to interview@cctechconsulting.com with the subject "DevOps ECS Challenge Submission - [Your Name]":
- Link to your GitHub repository
- A brief explanation of your approach and any challenges you faced

## Evaluation Criteria
Your submission will be evaluated based on:
1. Correct implementation of the required infrastructure and services
2. Effective use of Terraform for infrastructure as code
3. Proper implementation of containerization and ECS deployment
4. Successful integration of the application with RDS
5. Security considerations and implementation
6. Code quality, organization, and documentation
7. Ability to explain your design decisions and approach during the demo

## Demo Expectations
During the follow-up call, be prepared to:
- Show that each requirement was met and explain how
- Demonstrate the end-to-end process and prove it's working
- Answer questions about your solution and the components involved

---

# Deployment Guide & Explanation

## Prerequisites
- AWS account with permissions for ECS, ECR, RDS, ALB, VPC, IAM, Secrets Manager, S3, and DynamoDB
- AWS CLI configured locally (with OIDC role if using GitHub Actions)
- Terraform v1.3+
- Docker
- jq (for GitHub Actions pipeline)

## 1. Remote State Backend Setup
- Create an S3 bucket for Terraform state (e.g., `devsecops-tf-state`)
- Create a DynamoDB table for state locking (e.g., `devsecops-tf-locks`, with `LockID` as the primary key)

## 2. Configure Variables
Edit `terraform/environments/prod/variables.tf` or use a `terraform.tfvars` file with:
- `tf_state_bucket`, `tf_state_key`, `tf_state_lock_table`, `aws_region`
- Any other module variables you wish to override (e.g., DB username/password, subnet CIDRs, etc.)

## 3. Initialize and Apply Terraform
```sh
cd terraform/environments/prod
terraform init
terraform plan
terraform apply
```
- This will provision all AWS resources securely and output the ALB DNS name for your app.

## 4. Build and Push Docker Image (Manual or CI/CD)
- **Manual:**
  ```sh
  cd ../../..
  docker build -t devsecops-app:latest ./app
  aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
  docker tag devsecops-app:latest <account-id>.dkr.ecr.<region>.amazonaws.com/devsecops-app:latest
  docker push <account-id>.dkr.ecr.<region>.amazonaws.com/devsecops-app:latest
  ```
- **CI/CD:**
  - Push to `main` branch to trigger the GitHub Actions workflow in `.github/workflows/deploy.yml`.
  - Ensure your repo has the `AWS_OIDC_ROLE_ARN` secret set for OIDC authentication.

## 5. Access the Application
- After deployment, find the ALB DNS name in the Terraform output or AWS Console.
- Visit `http://<alb-dns-name>` to verify the app and database connectivity.

## 6. Security & Compliance Notes
- **SOC 2 Type 2:**
  - All secrets are managed in AWS Secrets Manager (never hardcoded)
  - IAM roles follow least privilege
  - RDS is in private subnets, not publicly accessible
  - All network access is tightly controlled by security groups
  - All infrastructure is managed as code for auditability
- **Audit Logging:**
  - Enable AWS CloudTrail and VPC Flow Logs for full auditability (recommended for production)
- **Encryption:**
  - RDS storage is encrypted
  - S3 state bucket should have encryption enabled

## 7. Troubleshooting
- **Terraform errors:** Check AWS permissions, backend config, and variable values
- **App not reachable:** Ensure ECS service is healthy, ALB target group has healthy targets, security groups allow traffic
- **DB connection issues:** Check Secrets Manager values, RDS security group, and subnet routing
- **CI/CD failures:** Review GitHub Actions logs, check AWS OIDC role permissions

## 8. Clean Up
To avoid ongoing AWS charges, destroy resources when done:
```sh
terraform destroy
```

## 9. Submission
- Push all code to your GitHub repository
- Email your repo link and a brief explanation to interview@cctechconsulting.com with the subject: `DevOps ECS Challenge Submission - [Your Name]`

---

# Solution Explanation

This solution uses modular, secure Terraform to provision:
- A VPC with public/private subnets, NAT, and IGW
- Security groups with least privilege for ALB, ECS, and RDS
- IAM roles for ECS/ECR/Secrets Manager with only required permissions
- ECR for Docker images
- ECS Fargate for containerized Next.js app
- RDS PostgreSQL in private subnets
- Secrets Manager for all DB credentials
- ALB for public access on port 80
- GitHub Actions for automated CI/CD

All code is organized for clarity, security, and auditability, following SOC 2 Type 2 and AWS best practices.

## Environment Variables for Application

The following environment variables must be provided to the ECS task (via AWS Secrets Manager):
- DB_USER
- DB_HOST
- DB_NAME
- DB_PASSWORD
- DB_PORT (default: 5432)
# Trigger workflow
