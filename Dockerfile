# 基础镜像
FROM mysql:8.4

# 设置 MySQL 环境变量
ENV MYSQL_ROOT_PASSWORD=root
ENV MYSQL_DATABASE=daily_tools
ENV MYSQL_USER=daily_tools_user
ENV MYSQL_PASSWORD=garlandqian123

# 初始化 SQL 文件（如果需要初始化数据库）
COPY init.sql /docker-entrypoint-initdb.d/

# 暴露默认 MySQL 端口
EXPOSE 3306
