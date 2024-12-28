# 基础镜像
FROM mysql:8.0

# 设置 MySQL 环境变量
ENV MYSQL_ROOT_PASSWORD=root
ENV MYSQL_DATABASE=daily_tools
ENV MYSQL_USER=daily_tools_user
ENV MYSQL_PASSWORD=garlandqian123

# 暴露默认 MySQL 端口
EXPOSE 3306
