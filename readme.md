# missioncontrol-Restful-Server

A simple restful server for [libmissioncontrol](https://github.com/andrew-bork/lib-Mission-Control)

### POST: /execute

Send the following JSON in the body:
```json
{
    "command: ...,
    "args": [...]
}
```
the command and args will be sent to the consumer program.

### GET: /data

Recieve the latest update from the consumer. Will be formatted according to the scheme.

### GET: /raw

Recieve the latest update from the consumer. The data is not formatted.