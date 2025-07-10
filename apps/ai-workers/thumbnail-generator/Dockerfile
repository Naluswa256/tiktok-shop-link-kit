FROM public.ecr.aws/lambda/python:3.11

# Install system dependencies for image processing
RUN yum update -y && \
    yum install -y \
    gcc \
    gcc-c++ \
    freetype-devel \
    yum-utils \
    findutils && \
    yum clean all

# Copy requirements and install dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY main.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD [ "main.lambda_handler" ]
