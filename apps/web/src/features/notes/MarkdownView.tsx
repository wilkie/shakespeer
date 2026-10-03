import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders note Markdown safely (ANN-002): CommonMark plus GitHub tables, strikethrough and
 * autolinks; raw HTML is never rendered; remote images are shown as links, not loaded; links
 * open in a new tab without access to this page.
 */
export function MarkdownView({ source }: { source: string }) {
  return (
    <Typography
      component="div"
      variant="body2"
      sx={{
        '& p': { my: 0.75 },
        '& table': { borderCollapse: 'collapse' },
        '& td, & th': { border: 1, borderColor: 'divider', px: 0.75 },
      }}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => (/^(https?:|mailto:|#)/i.test(url) ? url : '')}
        components={{
          a: ({ href, children }) => (
            <Link href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </Link>
          ),
          img: ({ src, alt }) =>
            typeof src === 'string' && src ? (
              <Link href={src} target="_blank" rel="noopener noreferrer">
                {alt?.trim() ? alt : 'image'}
              </Link>
            ) : null,
        }}
      >
        {source}
      </Markdown>
    </Typography>
  );
}
