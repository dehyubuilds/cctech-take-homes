# Rollback Instructions - AWS Resources Cleanup

This document provides step-by-step instructions to completely destroy all AWS resources created for the DevSecOps challenge to avoid ongoing charges.

## ⚠️ WARNING
**These instructions will permanently delete all resources. Make sure you want to destroy everything before proceeding.**

## Prerequisites
- AWS CLI configured with appropriate permissions
- Terraform installed
- Access to the AWS account where resources were created

## Step 1: Destroy Terraform Infrastructure

```bash
# Navigate to the terraform directory
cd terraform

# Initialize Terraform (if not already done)
terraform init

# Plan the destruction to see what will be deleted
terraform plan -destroy

# Destroy all resources
terraform destroy -auto-approve
```

## Step 2: Manual Cleanup (if Terraform fails)

If Terraform destroy fails or doesn't clean up everything, use these AWS CLI commands:

### Delete ECS Resources
```bash
# Delete ECS Service
aws ecs update-service --cluster devsecops-cluster --service devsecops-service --desired-count 0 --region us-east-1
aws ecs delete-service --cluster devsecops-cluster --service devsecops-service --region us-east-1

# Delete ECS Task Definitions
aws ecs deregister-task-definition --task-definition devsecops-task --region us-east-1

# Delete ECS Cluster
aws ecs delete-cluster --cluster devsecops-cluster --region us-east-1
```

### Delete ECR Repository
```bash
# Delete all images in the repository
aws ecr batch-delete-image --repository-name devsecops-app --image-ids imageTag=latest --region us-east-1

# Delete the repository
aws ecr delete-repository --repository-name devsecops-app --region us-east-1
```

### Delete RDS Instance
```bash
# Delete RDS instance (this will take several minutes)
aws rds delete-db-instance --db-instance-identifier devsecops-db --skip-final-snapshot --region us-east-1

# Delete parameter group
aws rds delete-db-parameter-group --db-parameter-group-name devsecops-db-param-group --region us-east-1

# Delete subnet group
aws rds delete-db-subnet-group --db-subnet-group-name devsecops-db-subnet-group --region us-east-1
```

### Delete Load Balancer
```bash
# Delete ALB
aws elbv2 delete-load-balancer --load-balancer-arn $(aws elbv2 describe-load-balancers --names devsecops-alb --region us-east-1 --query 'LoadBalancers[0].LoadBalancerArn' --output text) --region us-east-1

# Delete target group
aws elbv2 delete-target-group --target-group-arn $(aws elbv2 describe-target-groups --names devsecops-target-group --region us-east-1 --query 'TargetGroups[0].TargetGroupArn' --output text) --region us-east-1
```

### Delete Secrets Manager
```bash
# Delete the secret
aws secretsmanager delete-secret --secret-id devsecops-db-creds --force-delete-without-recovery --region us-east-1
```

### Delete IAM Roles and Policies
```bash
# Detach policies from roles
aws iam detach-role-policy --role-name devsecops-ecs-task-exec --policy-arn arn:aws:iam::142770202579:policy/devsecops-ecs-task-exec-policy --region us-east-1

# Delete policies
aws iam delete-policy --policy-arn arn:aws:iam::142770202579:policy/devsecops-ecs-task-exec-policy --region us-east-1

# Delete roles
aws iam delete-role --role-name devsecops-ecs-task-exec --region us-east-1
```

### Delete Security Groups
```bash
# Delete security groups (in order of dependencies)
aws ec2 delete-security-group --group-id $(aws ec2 describe-security-groups --filters "Name=group-name,Values=devsecops-ecs-sg" --region us-east-1 --query 'SecurityGroups[0].GroupId' --output text) --region us-east-1
aws ec2 delete-security-group --group-id $(aws ec2 describe-security-groups --filters "Name=group-name,Values=devsecops-rds-sg" --region us-east-1 --query 'SecurityGroups[0].GroupId' --output text) --region us-east-1
aws ec2 delete-security-group --group-id $(aws ec2 describe-security-groups --filters "Name=group-name,Values=devsecops-alb-sg" --region us-east-1 --query 'SecurityGroups[0].GroupId' --output text) --region us-east-1
```

### Delete VPC Resources
```bash
# Delete NAT Gateway
aws ec2 delete-nat-gateway --nat-gateway-id $(aws ec2 describe-nat-gateways --filters "Name=tag:Name,Values=devsecops-nat-gateway" --region us-east-1 --query 'NatGateways[0].NatGatewayId' --output text) --region us-east-1

# Delete Internet Gateway
aws ec2 detach-internet-gateway --internet-gateway-id $(aws ec2 describe-internet-gateways --filters "Name=tag:Name,Values=devsecops-igw" --region us-east-1 --query 'InternetGateways[0].InternetGatewayId' --output text) --vpc-id $(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=devsecops-vpc" --region us-east-1 --query 'Vpcs[0].VpcId' --output text) --region us-east-1
aws ec2 delete-internet-gateway --internet-gateway-id $(aws ec2 describe-internet-gateways --filters "Name=tag:Name,Values=devsecops-igw" --region us-east-1 --query 'InternetGateways[0].InternetGatewayId' --output text) --region us-east-1

# Delete subnets
aws ec2 delete-subnet --subnet-id $(aws ec2 describe-subnets --filters "Name=tag:Name,Values=devsecops-private-subnet-1" --region us-east-1 --query 'Subnets[0].SubnetId' --output text) --region us-east-1
aws ec2 delete-subnet --subnet-id $(aws ec2 describe-subnets --filters "Name=tag:Name,Values=devsecops-private-subnet-2" --region us-east-1 --query 'Subnets[0].SubnetId' --output text) --region us-east-1
aws ec2 delete-subnet --subnet-id $(aws ec2 describe-subnets --filters "Name=tag:Name,Values=devsecops-public-subnet-1" --region us-east-1 --query 'Subnets[0].SubnetId' --output text) --region us-east-1
aws ec2 delete-subnet --subnet-id $(aws ec2 describe-subnets --filters "Name=tag:Name,Values=devsecops-public-subnet-2" --region us-east-1 --query 'Subnets[0].SubnetId' --output text) --region us-east-1

# Delete VPC
aws ec2 delete-vpc --vpc-id $(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=devsecops-vpc" --region us-east-1 --query 'Vpcs[0].VpcId' --output text) --region us-east-1
```

### Delete CloudWatch Log Groups
```bash
# Delete ECS log group
aws logs delete-log-group --log-group-name /ecs/devsecops-task --region us-east-1
```

## Step 3: Verify Cleanup

```bash
# Check for any remaining resources
aws ec2 describe-instances --filters "Name=tag:Project,Values=DevSecOpsChallenge" --region us-east-1
aws rds describe-db-instances --region us-east-1
aws ecs list-clusters --region us-east-1
aws ecr describe-repositories --region us-east-1
```

## Step 4: Cost Monitoring

After cleanup, monitor your AWS billing dashboard to ensure no unexpected charges:
1. Go to AWS Billing Dashboard
2. Check the current month's charges
3. Verify no resources are still running

## Troubleshooting

If you encounter errors during cleanup:
1. Check resource dependencies
2. Ensure you have proper permissions
3. Some resources may take time to delete (especially RDS)
4. Use AWS Console as backup if CLI commands fail

## Estimated Costs (if not cleaned up)

- ECS Fargate: ~$0.40/day per task
- RDS t3.micro: ~$0.017/hour
- NAT Gateway: ~$0.045/hour
- ALB: ~$0.0225/hour
- **Total: ~$2-3/day if left running**

**Remember: Always clean up resources to avoid unexpected charges!** 