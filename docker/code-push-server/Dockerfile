FROM node:8.11.4-alpine

RUN npm config set registry https://registry.npm.taobao.org/ \ 
&& npm i -g code-push-server@0.4.3 --no-optional

EXPOSE 3000

CMD ["code-push-server"]
