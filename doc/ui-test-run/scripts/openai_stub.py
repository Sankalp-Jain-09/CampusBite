"""Minimal OpenAI chat-completions stub. Answers from the order JSON the backend sends; logs every request."""
import json, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOG = sys.argv[2]

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        user = body["messages"][-1]["content"]
        q = user.split("\n", 1)[0].replace("Question: ", "")
        ctx = json.loads(user.split("Order data (JSON):\n", 1)[1])
        with open(LOG, "a") as f:
            f.write(json.dumps({"t": time.time(), "question": q, "context": ctx}) + "\n")
        sp = ctx["spending"]
        lines = [f"(stub) You asked: {q}",
                 f"You have {ctx['total_orders']} orders. Spent this week: ₹{sp['this_week_since_monday']:.2f}, "
                 f"this month: ₹{sp['this_month']:.2f}, all time: ₹{sp['all_time']:.2f}."]
        for word in ("Byte Pizza", "Campus Curry House", "Green Bowl"):
            if word.lower() in q.lower():
                items = sorted({i["name"] for o in ctx["recent_orders_detailed"] if o["restaurant"] == word for i in o["items"]})
                lines.append(f"From {word} you ordered: {', '.join(items) or 'nothing recently'}.")
        if ctx["most_ordered_items"]:
            lines.append("Most ordered: " + ", ".join(i["name"] for i in ctx["most_ordered_items"][:3]) + ".")
        out = {"id": "stub", "object": "chat.completion", "created": int(time.time()), "model": body["model"],
               "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": " ".join(lines)}}],
               "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}}
        data = json.dumps(out).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)

ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
