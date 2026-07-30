# Container for Cloud Run: serves the static site + the API (Node/Express),
# stores data in Firestore. The whole repo is copied in so the server can serve
# index.html, paths/, runtime/, etc. from the repo root.
FROM node:20-slim
WORKDIR /app

# Install backend dependencies first (better build caching).
COPY backend/package.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy the rest of the site + server code (see .dockerignore for exclusions).
COPY . .

# Fail the image build unless the legacy Studio gate is successfully converted
# to explicit, fail-closed staging/production behaviour.
RUN node scripts/harden-studio-gate.mjs

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "backend/src/server.js"]
