# DevOps Engineer Take-Home Exam: Serving a Static Site with CI/CD

## Overview
This take-home exam assesses your skills in DevOps practices, focusing on infrastructure as code, cloud services configuration, and CI/CD pipeline setup. You'll build a complete CI/CD pipeline for deploying and updating a static website hosted on AWS S3 and distributed via CloudFront.

## Challenge Requirements
1. Use Terraform for all infrastructure provisioning
2. Configure S3 for static website hosting
3. Set up Amazon CloudFront for content distribution
4. Implement AWS CodePipeline for CI/CD
5. Use GitHub for source control
6. Provide clear documentation for your implementation
7. Be prepared to demonstrate and explain your solution in a follow-up call

## Functionality to Implement

### 1. Infrastructure as Code
- Use Terraform to codify all AWS resources
- Ensure the infrastructure can be redeployed to a different account with minor variable changes

### 2. S3 Static Website Hosting
- Configure an S3 bucket for static website hosting
- Set up appropriate bucket policies and permissions

### 3. CloudFront Distribution
- Set up a CloudFront distribution to serve content from the S3 static site
- Configure the default behavior to not cache content
- Add a behavior to cache images with a TTL of 30 minutes (default/minimum/maximum)
- Enable SSL using the Default CloudFront Certificate

### 4. CI/CD Pipeline
- Configure AWS CodePipeline to deploy and update the static site files
- Set up the pipeline to trigger on commits or merged pull requests to a specific branch
- Implement CloudFront distribution invalidation after updating files

## Project Structure
Organize your repository as follows:
- `/terraform`: Terraform configuration files
- `/website`: Static website source files
- `/pipeline`: CI/CD pipeline configuration files (if any additional config is needed)
- `README.md`: Project documentation

## Important Notes
- Ensure your Terraform code is modular and follows best practices
- Implement proper state management for Terraform (e.g., using an S3 backend)
- Follow the principle of least privilege for all IAM roles and policies
- Provide clear comments in your code and comprehensive documentation in your README.md
- Be prepared to explain each component of your solution and how they work together

## Submission Instructions
1. Create a new GitHub repository for this project
2. Ensure all your code is committed to your GitHub repository
3. Provide clear instructions in your README.md on how to deploy your solution
4. Email the following to interview@cctechconsulting.com with the subject "DevOps Static Site Challenge Submission - [Your Name]":
   - Link to your GitHub repository
   - A brief explanation of your approach and any challenges you faced

## Evaluation Criteria
Your submission will be evaluated based on:
1. Correct implementation of the required infrastructure and services
2. Effective use of Terraform for infrastructure as code
3. Proper configuration of S3, CloudFront, and CodePipeline
4. Completeness and efficiency of the CI/CD pipeline
5. Security considerations in your implementation
6. Code quality, organization, and documentation
7. Clarity of instructions and ease of deployment
8. Your ability to explain and demonstrate the solution in the follow-up call

## Demo Expectations
During the follow-up call, be prepared to:
- Show that each requirement was met and explain how
- Demonstrate the end-to-end process and prove it's working
- Answer questions about your solution and the components involved

We appreciate your time and effort. Good luck, and we look forward to reviewing your solution!
