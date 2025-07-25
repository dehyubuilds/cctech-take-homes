# DevSecOps Engineer Take-Home Exam: Containerized Architecture with RDS

## Overview
This take-home exam assesses your skills in DevSecOps practices, focusing on infrastructure as code, containerization, security implementation, and CI/CD pipeline setup. You'll build a secure, scalable containerized architecture using Terraform and AWS services, including an RDS PostgreSQL instance.

## Challenge Requirements
1. Use Terraform for all infrastructure provisioning
2. Implement AWS ECS (Elastic Container Service) with Fargate launch type
3. Use AWS ECR (Elastic Container Registry) for storing Docker images
4. Set up an RDS instance running PostgreSQL
5. Implement basic security measures using AWS IAM and Security Groups
6. Set up a CI/CD pipeline using AWS CodePipeline, CodeBuild, and CodeDeploy
7. Use GitHub for source control
8. Provide clear documentation for your implementation

## Functionality to Implement

### 1. Networking
- Create a VPC with two public and two private subnets across two availability zones
- Set up an Internet Gateway and NAT Gateways for internet connectivity
- Configure appropriate route tables

### 2. Compute and Containers
- Create an ECS cluster using Fargate launch type
- Set up an ECR repository for your application

### 3. Database Setup
- Provision an RDS instance running PostgreSQL in the private subnets using Terraform
- Configure appropriate security groups to allow traffic only from your application's security group and the CI/CD pipeline

### 4. Load Balancing and Routing
- Implement an Application Load Balancer (ALB) in the public subnets
- Create a target group for your application

### 5. Security
- Configure IAM roles for ECS tasks following the principle of least privilege
- Set up security groups for all components with appropriate inbound/outbound rules
- Implement a secure method for the application to access database credentials (if applicable)

### 6. Application Deployment
- Create a simple "Hello World" web application (use any programming language you're comfortable with)
- Build a Docker image for your application and push it to the ECR repository
- Create an ECS task definition and service to run the application
- Ensure the application is accessible through the Application Load Balancer

### 7. Database Integration
- If your chosen application requires a database:
  * Implement the necessary database interactions in your application
  * Ensure secure credential management (e.g., using AWS Secrets Manager)
- If your application doesn't require a database:
  * No need to modify your application for database integration

### 8. CI/CD Pipeline
Set up AWS CodePipeline with the following stages:

a. Source: Detect changes in your GitHub repository

b. Build: 
   - Use CodeBuild to build the Docker image and push it to ECR
   - Add a step to verify database connectivity:
     * If your app integrates with the database: Use your application's built-in check
     * If your app doesn't use the database: Add a simple PSQL command to test connectivity, for example:
       ```
       PGPASSWORD=${DB_PASSWORD} psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1;"
       ```
     * Ensure this step fails the build if database connection can't be established

c. Deploy: 
   - Use CodeDeploy to update the ECS task definition and implement blue/green deployment

## Getting Started
1. Create a new GitHub repository for this project
2. Install the necessary tools on your local machine:
   - Terraform
   - AWS CLI
   - Docker
3. Configure your AWS credentials locally
4. Initialize your Terraform working directory: `terraform init`
5. Write your Terraform configurations, application code, and CI/CD configurations
6. Apply your Terraform configuration: `terraform apply`

## Project Structure
Organize your repository as follows:
- `/terraform`: Terraform configuration files
- `/app`: Application code and Dockerfile
- `/pipeline`: CI/CD pipeline configuration files
- `README.md`: Project documentation

## Important Notes
- Use Terraform modules to keep your code modular and maintainable
- Implement Terraform state management using an S3 backend (include instructions for setting this up)
- Follow the principle of least privilege for all IAM roles
- Use AWS Secrets Manager for managing sensitive information, including database credentials if applicable
- Prioritize security in your implementation, considering network isolation and encryption
- Provide clear comments in your code and comprehensive documentation in your README.md
- Ensure the RDS instance is properly secured and not publicly accessible

## Bonus Points (Optional)
If time allows, consider implementing:
- AWS WAF on the Application Load Balancer
- CloudWatch for monitoring and logging
- Automated security scanning of the Docker image in the CI/CD pipeline

## Out of Scope
To help you focus on the core requirements of this challenge, the following items are considered out of scope:
1. Complex application logic: The "Hello World" application should be as simple as possible. Don't spend time creating a complex application.
2. Custom domain and SSL/TLS certificates: Use the default domain provided by AWS for your ALB. Setting up a custom domain with SSL/TLS is not necessary.
3. Comprehensive monitoring and alerting: While basic CloudWatch setup is welcome, creating an extensive monitoring and alerting system is not required.
4. Containerization of external services: You only need to containerize your main application. The database will run on RDS.
5. Advanced database features: Stick to basic CRUD operations if your app uses the database. Features like read replicas or multi-AZ deployment for RDS are not required unless you choose to implement them.

Remember, the main focus is on infrastructure as code, basic containerization, database setup, CI/CD pipeline setup, and fundamental security practices. Prioritize these aspects in your implementation.

## Submission Instructions
1. Ensure all your code is committed to your GitHub repository
2. Provide clear instructions in your README.md on how to deploy your solution
3. Email the following to [interview@cctechconsulting.com] with the subject "DevSecOps Code Challenge Submission - [Your Name]":

## Evaluation Criteria
Your submission will be evaluated based on:
1. Correct implementation of the required infrastructure and services
2. Effective use of Terraform for infrastructure as code
3. Proper implementation of containerization and ECS deployment
4. Security considerations and implementation
5. Completeness and efficiency of the CI/CD pipeline
6. Code quality, organization, and documentation
7. Clarity of instructions and ease of deployment
8. Bonus features (if implemented, but not required for a strong submission)

We appreciate your time and effort. Good luck, and we look forward to reviewing your solution!
