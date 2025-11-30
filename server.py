import http.server
import socketserver
import json
import os
import uuid
from datetime import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                data = json.loads(post_data.decode('utf-8'))

                # Determine which file to save based on the data structure or a hidden field
                filename = data.get('filename')
                content = data.get('content')

                if not filename or content is None:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'Missing filename or content')
                    return

                # Security check: prevent directory traversal or absolute paths
                if '..' in filename or filename.startswith('/') or filename.startswith('\\'):
                    self.send_response(403)
                    self.end_headers()
                    self.wfile.write(b'Invalid filename')
                    return

                file_path = os.path.join(BASE_DIR, filename)
                normalized_path = os.path.realpath(file_path)

                # Ensure file stays within project directory
                if not normalized_path.startswith(BASE_DIR):
                    self.send_response(403)
                    self.end_headers()
                    self.wfile.write(b'Invalid path')
                    return

                # Create directories if they don't exist (e.g., admin/data.json)
                os.makedirs(os.path.dirname(normalized_path), exist_ok=True)

                # Save the file
                with open(normalized_path, 'w', encoding='utf-8') as f:
                    if filename.endswith('.json'):
                        json.dump(content, f, indent=2)
                    else:
                        f.write(content)

                # If posts.json was updated, regenerate RSS
                if filename == 'posts.json':
                    self.generate_rss(content)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(
                    {'status': 'success', 'message': f'Saved {filename}'}).encode('utf-8'))

            except Exception as e:
                print(f"Error saving file: {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def generate_rss(self, posts):
        try:
            rss = ET.Element('rss', version='2.0')
            channel = ET.SubElement(rss, 'channel')

            ET.SubElement(channel, 'title').text = 'Battle Bros Comics Updates'
            ET.SubElement(channel, 'link').text = 'https://bwondercomics.com'
            ET.SubElement(channel, 'description').text = 'Latest updates from the Battle Bros universe.'
            ET.SubElement(channel, 'language').text = 'en-us'

            # Sort posts by date (newest first) just in case
            sorted_posts = sorted(posts, key=lambda x: x.get('date', ''), reverse=True)

            for post in sorted_posts:
                item = ET.SubElement(channel, 'item')
                ET.SubElement(item, 'title').text = post.get('title', 'Untitled Update')
                ET.SubElement(item, 'link').text = f"https://bwondercomics.com/feed.html#{post.get('id')}"
                ET.SubElement(item, 'guid').text = post.get('id')

                # Convert date to RFC 822 format if possible, otherwise use as is
                date_str = post.get('date', '')
                try:
                    # Assuming ISO format from JS (YYYY-MM-DDTHH:mm:ss.sssZ)
                    dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    pubDate = dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
                except Exception:
                    pubDate = date_str

                ET.SubElement(item, 'pubDate').text = pubDate

                description = post.get('content', '')
                if post.get('image'):
                    description = f'<img src="{post.get("image")}" /><br/>{description}'

                ET.SubElement(item, 'description').text = description

            # Pretty print XML
            xml_str = minidom.parseString(ET.tostring(rss)).toprettyxml(indent="  ")

            with open(os.path.join(BASE_DIR, 'rss.xml'), 'w', encoding='utf-8') as f:
                f.write(xml_str)

            print("RSS feed generated successfully.")

        except Exception as e:
            print(f"Error generating RSS: {e}")


print(f"Starting Battle Bros Server on port {PORT}...")
print("Press Ctrl+C to stop.")

# Ensure we are in the script's directory
os.chdir(BASE_DIR)

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
