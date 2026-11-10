# molecules.fyi is plain static files, served by nginx. nginx.conf tells
# browsers (and Cloudflare) to check for a newer page, scripts and styles on
# every visit, so a deploy shows up straight away.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
RUN rm /usr/share/nginx/html/nginx.conf
