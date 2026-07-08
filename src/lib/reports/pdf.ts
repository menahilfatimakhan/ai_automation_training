import PDFDocument from "pdfkit";

/** Renders a report as a PDF buffer. Pure formatting — narrative/metrics are supplied, never invented here. */
export function renderReportPdf(opts: {
  clientName: string;
  currency: string;
  reportLabel: string;
  periodStart: string;
  periodEnd: string;
  headline: string;
  narrative: string;
  metrics: Record<string, number | string>;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).fillColor("#111").text(`${opts.clientName}`, { continued: false });
    doc.fontSize(14).fillColor("#333").text(`${opts.reportLabel} Report`);
    doc.fontSize(10).fillColor("#666").text(`${opts.periodStart} to ${opts.periodEnd} · ${opts.currency}`);
    doc.moveDown();

    doc.fontSize(13).fillColor("#111").text(opts.headline, { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#333").text(opts.narrative, { align: "left" });
    doc.moveDown();

    doc.fontSize(13).fillColor("#111").text("Key Metrics");
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#333");
    const entries = Object.entries(opts.metrics);
    for (const [key, value] of entries) {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      doc.text(`${label}: ${value}`);
    }

    doc.moveDown();
    doc
      .fontSize(8)
      .fillColor("#999")
      .text(
        "Metrics are computed directly from logged data; the narrative above is AI-generated advisory commentary and is never the source of the figures.",
      );

    doc.end();
  });
}
