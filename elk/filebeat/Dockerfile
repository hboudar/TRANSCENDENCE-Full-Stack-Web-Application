FROM docker.elastic.co/beats/filebeat:8.15.0

COPY filebeat.yml /usr/share/filebeat/filebeat.yml

USER root
RUN chmod go-w /usr/share/filebeat/filebeat.yml

USER filebeat
