FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install --yes --no-install-recommends libreoffice-writer poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./

ENV RENTAL_DOCUMENT_CONVERTER_EXECUTABLE=/usr/bin/soffice
ENV RENTAL_DOCUMENT_CONVERTER_TIMEOUT_MS=45000
ENV RENTAL_DOCUMENT_MAX_BYTES=15728640

CMD ["npx", "vitest", "run", "src/modules/rentals/documents/pdf/convert-docx-to-pdf.integration.test.ts"]
