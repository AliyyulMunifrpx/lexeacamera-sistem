"use client";

// Teks dari API memakai \r\n, tab, dan "•".
// Dipecah per bagian: baris berawalan angka ("1. Ketentuan Umum") jadi judul kartu.
function parseTerms(text) {
  const sections = [];
  let current = null;

  text.split(/\r?\n/).forEach((raw) => {
    const tabs = raw.match(/^\t*/)[0].length;
    const content = raw.trim();

    if (!content) return;

    if (/^\d+\.\s/.test(content)) {
      current = { title: content, lines: [] };
      sections.push(current);
      return;
    }

    // Teks sebelum judul pertama masuk ke bagian tanpa judul.
    if (!current) {
      current = { title: null, lines: [] };
      sections.push(current);
    }

    const isBullet = content.startsWith("•");

    current.lines.push({
      tabs,
      isBullet,
      content: isBullet ? content.replace(/^•\s*/, "") : content,
    });
  });

  return sections;
}

export default function TermsHomePage({ data }) {
  const text = data?.store?.terms_and_condition ?? "";

  if (!text.trim()) {
    return (
      <p className="py-10 text-center text-sm text-second/50">
        Syarat dan ketentuan belum tersedia.
      </p>
    );
  }

  const sections = parseTerms(text);

  return (
    <div className="w-full space-y-4">
      {sections.map((section, index) => (
        <section key={index} className="space-y-2 rounded-md">
          {section.title && (
            <h3 className="font-semibold text-second">{section.title}</h3>
          )}

          <div className="space-y-2 text-sm text-second/70">
            {section.lines.map((line, lineIndex) => (
              <p
                key={lineIndex}
                style={{ paddingLeft: `${line.tabs * 16}px` }}
                className={line.isBullet ? "flex gap-2" : ""}
              >
                {line.isBullet && <span className="text-second/40">•</span>}
                <span>{line.content}</span>
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
