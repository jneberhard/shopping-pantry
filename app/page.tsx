import Script from 'next/script';
export default function Kitchen() {
  return <><div id="app"><div style={{padding:40,color:'#254c3b'}}>Opening your kitchen…</div></div><dialog id="modal"/><div id="toast" role="status"/><Script type="module" src="/app.js" strategy="afterInteractive"/></>;
}
