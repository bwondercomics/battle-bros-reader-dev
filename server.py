import http.server
import socketserver
import json
import os
import uuid
import base64
import re
import shutil
from datetime import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOWED_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}


def safe_path(path):
    """Return an absolute path under BASE_DIR or raise ValueError."""
    normalized = os.path.realpath(os.path.join(BASE_DIR, path.replace('/', os.sep)))
    if not normalized.startswith(BASE_DIR):
        raise ValueError("Invalid path")
    return normalized


def extract_numbers(filename):
    match = re.search(r'(\d+)', filename)
    return int(match.group(1)) if match else -1


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def _read_json(self):
        content_length = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(content_length) if content_length else b''
        return json.loads(data.decode('utf-8')) if data else {}

    def _json(self, status, payload):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def do_POST(self):
        try:
            if self.path == '/api/save':
                self.handle_save()
            elif self.path == '/api/upload-images':
                self.handle_upload_images()
            elif self.path == '/api/delete-image':
                self.handle_delete_image()
            elif self.path == '/api/rename-image':
                self.handle_rename_image()
            elif self.path == '/api/renumber-chapter':
                self.handle_renumber_chapter()
            elif self.path == '/api/list-images':
                self.handle_list_images()
            elif self.path == '/api/create-chapter':
                self.handle_create_chapter()
            else:
                self.send_response(404)
                self.end_headers()
        except Exception as e:
            print(f"Error handling {self.path}: {e}")
            self._json(500, {'error': str(e)})

    # ----------------------- JSON SAVE (existing) -----------------------
    def handle_save(self):
        data = self._read_json()

        filename = data.get('filename')
        content = data.get('content')

        if not filename or content is None:
            self._json(400, {'error': 'Missing filename or content'})
            return

        if '..' in filename or filename.startswith('/') or filename.startswith('\\'):
            self._json(403, {'error': 'Invalid filename'})
            return

        file_path = os.path.join(BASE_DIR, filename)
        normalized_path = os.path.realpath(file_path)

        if not normalized_path.startswith(BASE_DIR):
            self._json(403, {'error': 'Invalid path'})
            return

        os.makedirs(os.path.dirname(normalized_path), exist_ok=True)

        with open(normalized_path, 'w', encoding='utf-8') as f:
            if filename.endswith('.json'):
                json.dump(content, f, indent=2)
            else:
                f.write(content)

        if filename == 'posts.json':
            self.generate_rss(content)

        self._json(200, {'status': 'success', 'message': f'Saved {filename}'})

    # ----------------------- IMAGE UPLOAD -----------------------
    def handle_upload_images(self):
        data = self._read_json()
        chapter_folder = (data.get('chapterFolder') or '').strip().strip('/')
        files = data.get('files') or []

        if not chapter_folder or not isinstance(files, list):
            self._json(400, {'error': 'chapterFolder and files are required'})
            return

        try:
            dest_dir = safe_path(chapter_folder)
        except ValueError:
            self._json(400, {'error': 'Invalid chapter path'})
            return

        os.makedirs(dest_dir, exist_ok=True)

        existing_numbers = []
        for name in os.listdir(dest_dir):
            if os.path.splitext(name)[1].lower() in ALLOWED_IMAGE_EXTENSIONS:
                num = extract_numbers(name)
                if num >= 1:
                    existing_numbers.append(num)
        next_number = max(existing_numbers) + 1 if existing_numbers else 1

        stored_paths = []
        errors = []

        for idx, file_info in enumerate(files):
            name = file_info.get('name') or f'file_{idx}'
            ext = os.path.splitext(name)[1].lower()
            if ext not in ALLOWED_IMAGE_EXTENSIONS:
                errors.append({'file': name, 'error': 'Unsupported file type'})
                continue

            b64_data = file_info.get('data')
            if not b64_data:
                errors.append({'file': name, 'error': 'Missing data'})
                continue

            try:
                raw = base64.b64decode(b64_data)
            except Exception:
                errors.append({'file': name, 'error': 'Invalid base64 data'})
                continue

            new_name = f"{next_number:02d}{ext}"
            next_number += 1

            try:
                with open(os.path.join(dest_dir, new_name), 'wb') as f:
                    f.write(raw)
                stored_paths.append(f"{chapter_folder}/{new_name}")
            except Exception as e:
                errors.append({'file': name, 'error': str(e)})

        status = 200 if stored_paths else 400
        self._json(status, {'paths': stored_paths, 'errors': errors})

    # ----------------------- IMAGE DELETE -----------------------
    def handle_delete_image(self):
        data = self._read_json()
        rel_path = (data.get('path') or '').strip().strip('/')
        if not rel_path:
            self._json(400, {'error': 'path is required'})
            return

        try:
            abs_path = safe_path(rel_path)
        except ValueError:
            self._json(400, {'error': 'Invalid path'})
            return

        if not os.path.exists(abs_path):
            self._json(404, {'error': 'File not found'})
            return

        try:
            os.remove(abs_path)
        except Exception as e:
            self._json(500, {'error': str(e)})
            return

        self._json(200, {'status': 'deleted', 'path': rel_path})

    # ----------------------- IMAGE RENAME -----------------------
    def handle_rename_image(self):
        data = self._read_json()
        src = (data.get('from') or '').strip().strip('/')
        dest = (data.get('to') or '').strip().strip('/')

        if not src or not dest:
            self._json(400, {'error': 'from and to are required'})
            return

        try:
            abs_src = safe_path(src)
            abs_dest = safe_path(dest)
        except ValueError:
            self._json(400, {'error': 'Invalid path'})
            return

        if not os.path.exists(abs_src):
            self._json(404, {'error': 'Source file not found'})
            return

        if os.path.exists(abs_dest):
            self._json(409, {'error': 'Destination already exists'})
            return

        os.makedirs(os.path.dirname(abs_dest), exist_ok=True)

        try:
            os.replace(abs_src, abs_dest)
        except Exception as e:
            self._json(500, {'error': str(e)})
            return

        self._json(200, {'status': 'renamed', 'from': src, 'to': dest})

    # ----------------------- CHAPTER RENUMBER -----------------------
    def handle_renumber_chapter(self):
        data = self._read_json()
        chapter_folder = (data.get('chapterFolder') or '').strip().strip('/')
        order = data.get('order') or []

        if not chapter_folder or not isinstance(order, list) or not order:
            self._json(400, {'error': 'chapterFolder and non-empty order are required'})
            return

        try:
            target_dir = safe_path(chapter_folder)
        except ValueError:
            self._json(400, {'error': 'Invalid chapter path'})
            return

        os.makedirs(target_dir, exist_ok=True)

        moves = []
        for idx, rel_path in enumerate(order):
            rel_path = (rel_path or '').strip().strip('/')
            try:
                abs_src = safe_path(rel_path)
            except ValueError:
                self._json(400, {'error': f'Invalid path: {rel_path}'})
                return

            if not os.path.exists(abs_src):
                self._json(404, {'error': f'File not found: {rel_path}'})
                return

            ext = os.path.splitext(abs_src)[1].lower()
            if ext not in ALLOWED_IMAGE_EXTENSIONS:
                self._json(400, {'error': f'Unsupported file type for {rel_path}'})
                return

            new_name = f"{idx + 1:02d}{ext}"
            new_rel = f"{chapter_folder}/{new_name}"
            abs_dest = safe_path(new_rel)
            moves.append((abs_src, abs_dest, new_rel))

        # Two-phase rename to avoid collisions
        temp_moves = []
        for abs_src, _, _ in moves:
            temp_name = abs_src + f".tmp-{uuid.uuid4().hex}"
            shutil.move(abs_src, temp_name)
            temp_moves.append(temp_name)

        new_paths = []
        try:
            for temp_src, (_, abs_dest, new_rel) in zip(temp_moves, moves):
                os.makedirs(os.path.dirname(abs_dest), exist_ok=True)
                shutil.move(temp_src, abs_dest)
                new_paths.append(new_rel)
        except Exception as e:
            self._json(500, {'error': str(e)})
            return

        self._json(200, {'status': 'renumbered', 'paths': new_paths})

    # ----------------------- LIST IMAGES -----------------------
    def handle_list_images(self):
        data = self._read_json()
        chapter_folder = (data.get('chapterFolder') or '').strip().strip('/')

        if not chapter_folder:
            self._json(400, {'error': 'chapterFolder is required'})
            return

        try:
            target_dir = safe_path(chapter_folder)
        except ValueError:
            self._json(400, {'error': 'Invalid chapter path'})
            return

        if not os.path.exists(target_dir):
            self._json(200, {'paths': []})
            return

        files = []
        for name in os.listdir(target_dir):
            ext = os.path.splitext(name)[1].lower()
            if ext in ALLOWED_IMAGE_EXTENSIONS:
                files.append(name)

        files.sort(key=lambda n: (extract_numbers(n), n))
        paths = [f"{chapter_folder}/{name}" for name in files]

        self._json(200, {'paths': paths})

    # ----------------------- CREATE CHAPTER FOLDER -----------------------
    def handle_create_chapter(self):
        data = self._read_json()
        chapter_folder = (data.get('chapterFolder') or '').strip().strip('/')

        if not chapter_folder:
            self._json(400, {'error': 'chapterFolder is required'})
            return

        try:
            dest_dir = safe_path(chapter_folder)
            os.makedirs(dest_dir, exist_ok=True)
        except ValueError:
            self._json(400, {'error': 'Invalid chapter path'})
            return
        except Exception as e:
            self._json(500, {'error': str(e)})
            return

        self._json(200, {'status': 'ok', 'folder': chapter_folder})

    def generate_rss(self, posts):
        try:
            rss = ET.Element('rss', version='2.0')
            channel = ET.SubElement(rss, 'channel')

            ET.SubElement(channel, 'title').text = 'Battle Bros Comics Updates'
            ET.SubElement(channel, 'link').text = 'https://bwondercomics.com'
            ET.SubElement(channel, 'description').text = 'Latest updates from the Battle Bros universe.'
            ET.SubElement(channel, 'language').text = 'en-us'

            sorted_posts = sorted(
                [p for p in posts if p.get('share', True)],
                key=lambda x: x.get('date', ''),
                reverse=True
            )

            for post in sorted_posts:
                item = ET.SubElement(channel, 'item')
                ET.SubElement(item, 'title').text = post.get('title', 'Untitled Update')
                ET.SubElement(item, 'link').text = f"https://bwondercomics.com/feed.html#{post.get('id')}"
                ET.SubElement(item, 'guid').text = post.get('id')

                date_str = post.get('date', '')
                try:
                    dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    pubDate = dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
                except Exception:
                    pubDate = date_str

                ET.SubElement(item, 'pubDate').text = pubDate

                description = post.get('content', '')
                if post.get('image'):
                    description = f'<img src="{post.get("image")}" /><br/>{description}'

                ET.SubElement(item, 'description').text = description

            xml_str = minidom.parseString(ET.tostring(rss)).toprettyxml(indent="  ")

            with open(os.path.join(BASE_DIR, 'rss.xml'), 'w', encoding='utf-8') as f:
                f.write(xml_str)

            print("RSS feed generated successfully.")

        except Exception as e:
            print(f"Error generating RSS: {e}")


print(f"Starting Battle Bros Server on port {PORT}...")
print("Press Ctrl+C to stop.")

os.chdir(BASE_DIR)

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
