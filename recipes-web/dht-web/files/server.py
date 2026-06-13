from http.server import BaseHTTPRequestHandler, HTTPServer
import json

TEMP = "/sys/bus/iio/devices/iio:device0/in_temp_input"
HUM  = "/sys/bus/iio/devices/iio:device0/in_humidityrelative_input"

class Handler(BaseHTTPRequestHandler):

    def do_GET(self):

        if self.path == "/":

            with open("/opt/dht-web/index.html") as f:
                html = f.read()

            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()

            self.wfile.write(html.encode())

        elif self.path == "/sensor":

            with open(TEMP) as f:
                temp = int(f.read()) / 1000

            with open(HUM) as f:
                hum = int(f.read()) / 1000

            data = {
                "temperature": temp,
                "humidity": hum
            }

            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()

            self.wfile.write(json.dumps(data).encode())

HTTPServer(("", 8080), Handler).serve_forever()