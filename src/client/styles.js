export const styles = String.raw`
.deepseek-flow-root{--df-border:var(--dsw-alias-border-l1);--df-border-strong:var(--dsw-alias-border-l2);--df-bg:var(--dsw-alias-bg-base);--df-layer:var(--dsw-alias-bg-layer-1);--df-layer-2:var(--dsw-alias-bg-layer-2);--df-brand:var(--dsw-alias-brand-primary);--df-on-brand:var(--dsw-alias-label-primary-inverse,var(--dsw-alias-label-reverse,var(--df-bg)));--df-ink:var(--dsw-alias-label-primary);--df-ink-2:var(--dsw-alias-label-secondary);--df-ok:var(--dsw-alias-state-success-primary);--df-warn:var(--dsw-alias-state-warn-primary);--df-err:var(--dsw-alias-state-error-primary);position:relative;inset:auto;width:100%;height:100%;max-height:100vh;min-height:0;display:grid;grid-template-rows:48px minmax(0,1fr);background:var(--df-bg);color:var(--df-ink);font:13px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
.deepseek-flow-root *{box-sizing:border-box}
.deepseek-flow-root button,.deepseek-flow-root input,.deepseek-flow-root select,.deepseek-flow-root textarea{font:inherit}
.deepseek-flow-root button{cursor:pointer}
.df-tabs{display:flex;align-items:center;gap:10px;padding:0 20px;background:var(--df-layer);border-bottom:1px solid var(--df-border)}
.df-titlebar__title{font-size:14px;font-weight:720;color:var(--df-ink)}
.df-titlebar__badge{padding:3px 7px;border-radius:999px;background:color-mix(in srgb,var(--df-brand) 10%,transparent);color:var(--df-brand);font-size:10px;font-weight:700}
.df-titlebar__note{color:var(--df-ink-2);font-size:11px}
.df-titlebar__rev{margin-left:auto;color:var(--df-ink-2);font:9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.72}
.df-main{min-height:0;overflow:hidden}
.df-toolbar{flex:none;height:52px;min-height:52px;display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--df-layer);border-bottom:1px solid var(--df-border);flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}
.df-toolbar>*{flex:none}
.df-toolbar>label{display:flex;align-items:center;gap:7px;color:var(--df-ink-2);font-size:12px}
.df-toolbar select,.df-toolbar input,.df-toolbar textarea{border:1px solid var(--df-border-strong);border-radius:7px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 8px;outline:0}
.df-toolbar input:focus,.df-toolbar select:focus,.df-toolbar textarea:focus{border-color:var(--df-brand)}
.df-btn{border:1px solid var(--df-border-strong);border-radius:8px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 11px;transition:border-color .15s ease,transform .15s ease,background .15s ease}
.df-btn:hover{border-color:var(--df-brand);transform:translateY(-1px)}
.df-btn.is-primary{border-color:var(--df-brand);background:var(--df-brand);color:var(--df-on-brand);font-weight:650}
.df-btn.is-ghost{background:transparent}
.df-btn:disabled{opacity:.5;cursor:default}
 .df-btn.is-disabled{opacity:.45;cursor:not-allowed}
.df-status{color:var(--df-ink-2);font-size:12px;margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38%}
.df-studio{height:100%;display:grid;grid-template-rows:minmax(0,1fr);min-height:0;min-width:0;background:var(--df-bg);overflow:hidden}
.df-canvas-shell{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;background:var(--df-bg);overflow:hidden}
.df-canvas-stage{position:relative;flex:1;min-height:0;display:flex;overflow:hidden}
.df-canvas{flex:1;min-height:0;position:relative;overflow:hidden;touch-action:none;user-select:none;background-color:var(--df-bg);background-image:radial-gradient(circle,var(--df-border-strong) 1.1px,transparent 1.2px),radial-gradient(circle at 50% 0%,color-mix(in srgb,var(--df-brand) 6%,transparent),transparent 42%);background-size:24px 24px,100% 100%;cursor:grab}
.df-canvas.is-panning{cursor:grabbing}
.df-graph__stage{position:absolute;left:0;top:0;width:1px;height:1px;transform-origin:0 0;will-change:transform}
.df-graph__edges{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none}
.df-graph__edge{fill:none!important;stroke:var(--df-brand);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 0 2px color-mix(in srgb,var(--df-brand) 36%,transparent));pointer-events:none}
.df-graph__edge.is-selected{stroke-width:3.6;filter:drop-shadow(0 0 4px color-mix(in srgb,var(--df-brand) 58%,transparent))}
.df-graph__edge-hit{fill:none!important;stroke:transparent;stroke-width:18;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}
.df-graph__connection{fill:none!important;stroke:var(--df-brand);stroke-width:2;stroke-dasharray:7 5;vector-effect:non-scaling-stroke;pointer-events:none}
.df-graph__label-bg{fill:var(--df-layer);stroke:var(--df-border);stroke-width:1;vector-effect:non-scaling-stroke}
.df-graph__label{fill:var(--df-ink);font-size:10px;font-weight:750;text-anchor:middle;dominant-baseline:middle;pointer-events:none}
.df-graph__node{position:absolute;width:208px;height:116px;pointer-events:auto;cursor:grab}
.df-graph__node.is-dragging{cursor:grabbing}
.df-graph__node.is-connect-target{outline:2px solid var(--df-brand);outline-offset:3px;box-shadow:0 0 0 4px color-mix(in srgb,var(--df-brand) 14%,transparent),0 10px 28px color-mix(in srgb,var(--df-ink) 18%,transparent)}
.df-graph__node.is-connect-target .df-graph__handle--target{transform:translateY(-50%) scale(1.25);background:var(--df-brand)}
.df-graph__handle{position:absolute;z-index:4;top:50%;width:13px;height:13px;padding:0;border:2px solid var(--df-bg);border-radius:50%;background:var(--df-brand);transform:translateY(-50%);cursor:crosshair;box-shadow:0 0 0 1px color-mix(in srgb,var(--df-brand) 65%,var(--df-border-strong));transition:transform .14s ease,box-shadow .14s ease}
.df-graph__handle:hover,.df-graph__handle:focus-visible{transform:translateY(-50%) scale(1.18);box-shadow:0 0 0 5px color-mix(in srgb,var(--df-brand) 18%,transparent);outline:0}
.df-graph__handle--target{left:-6px}
.df-graph__handle--source{right:-6px}
.df-graph__controls{position:absolute;z-index:8;left:12px;bottom:12px;display:grid;border:1px solid var(--df-border-strong);border-radius:9px;overflow:hidden;background:var(--df-layer);box-shadow:0 8px 20px color-mix(in srgb,var(--df-ink) 9%,transparent)}
.df-graph__controls button{width:32px;height:30px;border:0;border-bottom:1px solid var(--df-border);background:var(--df-layer-2);color:var(--df-ink);font-weight:750}
.df-graph__controls button:last-child{border-bottom:0}
.df-graph__controls button:hover{background:color-mix(in srgb,var(--df-brand) 10%,var(--df-layer-2));color:var(--df-brand)}
.df-empty-flow{position:absolute;inset:0;z-index:6;display:grid;place-items:center;padding:24px;pointer-events:none}
.df-empty-flow__card{max-width:430px;padding:22px 26px;border:1px dashed var(--df-border-strong);border-radius:14px;background:var(--df-layer);color:var(--df-ink-2);font-size:12px;line-height:1.7;text-align:center;box-shadow:0 10px 30px color-mix(in srgb,var(--df-ink) 10%,transparent)}
.df-empty-flow__card strong{display:block;margin-bottom:6px;color:var(--df-ink);font-size:13px}
.df-topology-apply{position:absolute;z-index:14;right:18px;bottom:18px;display:flex;filter:drop-shadow(0 10px 22px color-mix(in srgb,var(--df-ink) 20%,transparent))}
.deepseek-flow-root .df-topology-apply>.df-btn{min-height:42px;display:inline-flex;align-items:center;gap:8px;padding:8px 13px;border-radius:12px}
.df-topology-apply__icon{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--df-on-brand) 20%,transparent);font-size:12px;font-weight:850}
.df-topology-apply__count{display:grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:color-mix(in srgb,var(--df-on-brand) 18%,transparent);font-size:10px;font-weight:800}
.df-node{width:100%;height:100%;padding:12px 14px;border:1px solid var(--df-border-strong);border-radius:12px;background:color-mix(in srgb,var(--df-layer) 96%,var(--df-brand) 4%);color:var(--df-ink);box-shadow:0 8px 24px color-mix(in srgb,var(--df-ink) 9%,transparent);transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease;overflow:hidden}
.df-node:hover{border-color:color-mix(in srgb,var(--df-brand) 55%,var(--df-border-strong));box-shadow:0 12px 30px color-mix(in srgb,var(--df-ink) 12%,transparent)}
.df-node.is-selected{border-color:var(--df-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--df-brand) 18%,transparent),0 12px 30px color-mix(in srgb,var(--df-ink) 12%,transparent)}
.df-node__kind{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--df-ink-2);margin-bottom:2px}
.df-node__label{font-weight:650;font-size:13px;word-break:break-word}
.df-node__prompt{margin-top:5px;font-size:11px;color:var(--df-ink-2);white-space:pre-wrap;max-height:34px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.df-node__file{margin-top:8px;padding-top:7px;border-top:1px solid var(--df-border);font:10px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--df-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-node--input .df-node__kind{color:var(--df-ok)}
.df-node--agent .df-node__kind{color:var(--df-brand)}
.df-node--mapAgent .df-node__kind{color:var(--df-warn)}
.df-node--condition .df-node__kind{color:var(--df-warn)}
.df-node--merge .df-node__kind{color:var(--df-ink-2)}
.df-node--output .df-node__kind{color:var(--df-err)}
.df-docrail{min-width:0;width:auto;display:flex;flex-direction:column;background:var(--df-layer);min-height:0;overflow:hidden}
.df-docrail.is-collapsed{visibility:hidden;pointer-events:none}
.df-docrail__head{position:relative;min-height:58px;padding:12px 14px 10px;border-bottom:1px solid var(--df-border)}
.df-docrail__title{font-size:13px;font-weight:700;color:var(--df-ink)}
.df-docrail__note{margin-top:3px;font-size:10px;line-height:1.45;color:var(--df-ink-2)}
.df-docrail__list{flex:1 1 0;height:0;min-height:0;overflow:auto;overscroll-behavior:contain;padding:9px;display:flex;flex-direction:column;gap:6px;scrollbar-width:thin}
.df-docgroup{padding:5px 7px 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--df-ink-2)}
.df-docitem{width:100%;display:grid;grid-template-columns:24px minmax(0,1fr);gap:9px;align-items:center;text-align:left;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--df-ink);padding:8px}
.df-docitem:hover{background:var(--df-layer-2);border-color:var(--df-border)}
.df-docitem.is-active{background:color-mix(in srgb,var(--df-brand) 10%,var(--df-layer));border-color:color-mix(in srgb,var(--df-brand) 45%,var(--df-border));color:var(--df-brand)}
.df-docitem__icon{width:24px;height:28px;border:1px solid currentColor;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;opacity:.76}
.df-docitem__label{display:block;font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-docitem__path{display:block;font:9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--df-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-inspector{min-width:0;width:auto;height:100%;max-height:100%;display:flex;flex-direction:column;background:var(--df-layer);overflow:hidden;min-height:0}
 .df-inspector__scroll{flex:1 1 0;height:0;min-height:0;overflow:auto;overscroll-behavior:contain;padding:15px;display:flex;flex-direction:column;gap:11px;scrollbar-width:thin}
 .df-inspector__scroll>*{flex-shrink:0}
 .df-inspector>*{flex-shrink:0}
.df-inspector.is-collapsed{visibility:hidden;pointer-events:none;padding:0}
.df-inspector h3{margin:0;font-size:14px;color:var(--df-ink)}
.df-inspector label{display:grid;gap:4px;color:var(--df-ink-2);font-size:12px}
.df-inspector input,.df-inspector select,.df-inspector textarea{width:100%;border:1px solid var(--df-border-strong);border-radius:7px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 8px;outline:0}
.df-inspector textarea{min-height:92px;resize:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.55}
.df-inspector textarea.df-markdown-editor{min-height:300px;max-height:60vh;resize:none;background:var(--df-bg);border-radius:10px;overflow-y:auto;scrollbar-width:thin}
.df-advanced{border:1px solid var(--df-border);border-radius:9px;background:var(--df-layer-2);padding:0 9px}
.df-advanced summary{cursor:pointer;padding:8px 0;color:var(--df-ink-2);font-size:11px;font-weight:650}
.df-advanced__content{display:grid;gap:9px;padding:0 0 10px}
.df-pathbox{display:flex;flex-direction:column;gap:2px;padding:9px 10px;border:1px solid var(--df-border);border-radius:9px;background:var(--df-layer-2)}
.df-pathbox__label{font-size:10px;color:var(--df-ink-2)}
.df-pathbox__value{font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--df-ink);word-break:break-all}
.df-inspector .df-empty{color:var(--df-ink-2);font-size:12px}
.df-addbar{flex:none;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 14px;border-top:1px solid var(--df-border);background:var(--df-layer)}
.df-addbar button{font-size:11px;padding:4px 9px}
.df-connect-hint{margin-left:auto;color:var(--df-ink-2);font-size:10px;white-space:nowrap}
.df-iconbtn{width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:16px}
.df-splitter{position:relative;z-index:12;min-width:9px;width:9px;cursor:col-resize;touch-action:none;background:var(--df-layer);outline:0}
.df-splitter::before{content:"";position:absolute;inset:0 3px;background:var(--df-border)}
.df-splitter::after{content:"";position:absolute;top:50%;left:50%;width:3px;height:42px;transform:translate(-50%,-50%);border-radius:999px;background:var(--df-border-strong);box-shadow:0 -7px 0 var(--df-border-strong),0 7px 0 var(--df-border-strong)}
.df-splitter:hover::before,.df-splitter:focus-visible::before,.df-splitter.is-dragging::before{inset:0 2px;background:var(--df-brand)}
.df-splitter.is-collapsed{background:color-mix(in srgb,var(--df-brand) 5%,var(--df-layer))}
.df-splitter.is-collapsed::after{background:var(--df-brand);box-shadow:0 -7px 0 var(--df-brand),0 7px 0 var(--df-brand)}
.df-assistant-splitter{position:relative;z-index:10;flex:none;height:8px;cursor:row-resize;touch-action:none;background:var(--df-layer)}
.df-assistant-splitter::before{content:"";position:absolute;inset:3px 0;background:var(--df-border)}
.df-assistant-splitter::after{content:"";position:absolute;left:50%;top:50%;width:44px;height:3px;transform:translate(-50%,-50%);border-radius:999px;background:var(--df-border-strong)}
.df-assistant-splitter:hover::before,.df-assistant-splitter:focus-visible::before,.df-assistant-splitter.is-dragging::before{inset:2px 0;background:var(--df-brand)}
.df-assistant{flex:none;background:var(--df-layer);min-height:44px;display:flex;flex-direction:column;overflow:hidden}
.df-assistant.is-open{max-height:min(440px,54%)}
.df-assistant__head{height:46px;flex:none;display:flex;align-items:center;gap:8px;padding:7px 14px}
.df-assistant__spark{width:27px;height:27px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--df-brand) 12%,var(--df-layer));color:var(--df-brand);font-weight:800}
.df-assistant__title{font-size:11px;font-weight:750;color:var(--df-ink);white-space:nowrap}
.df-assistant__target{max-width:190px;padding:3px 8px;border:1px solid var(--df-border);border-radius:999px;color:var(--df-ink-2);font:9px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .df-assist-menu-wrap{position:relative;display:flex;align-items:center;flex:none}
 .deepseek-flow-root .df-assist-menu-btn{display:inline-flex;align-items:center;gap:4px;max-width:170px;border:1px solid var(--df-border-strong);border-radius:999px;background:var(--df-layer-2);color:var(--df-ink);padding:2px 8px;font-size:9px;line-height:1.35;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .deepseek-flow-root .df-assist-menu-btn:hover{border-color:var(--df-brand)}
 .deepseek-flow-root .df-assist-menu-caret{font-size:8px;color:var(--df-ink-2);flex:none}
 .df-assist-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:40;min-width:230px;max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:6px;border:1px solid var(--df-border-strong);border-radius:14px;background:var(--df-layer);box-shadow:0 14px 36px color-mix(in srgb,var(--df-ink) 16%,transparent)}
 .deepseek-flow-root .df-assist-menu-item{display:flex;align-items:center;gap:6px;text-align:left;border:0;border-radius:10px;background:transparent;color:var(--df-ink);padding:8px 11px;font-size:11px;cursor:pointer}
 .deepseek-flow-root .df-assist-menu-item:hover{background:var(--df-layer-2)}
 .deepseek-flow-root .df-assist-menu-back{display:flex;align-items:center;border:0;border-radius:10px;background:transparent;color:var(--df-ink-2);padding:7px 11px;font-size:11px;cursor:pointer}
 .deepseek-flow-root .df-assist-menu-back:hover{background:var(--df-layer-2)}
.df-assistant__actions{margin-left:auto;display:flex;align-items:center;gap:6px;flex:none}
.df-assistant__head .df-btn{font-size:10px;padding:4px 8px}
.df-assistant__toggle{width:28px;height:28px;padding:0;font-size:14px}
.df-assistant__body{min-height:0;flex:1;display:grid;grid-template-columns:minmax(230px,.72fr) minmax(360px,1.28fr);gap:10px;padding:0 14px 12px;overflow:hidden}
.df-assistant__control{display:flex;min-width:0;min-height:0;flex-direction:column;gap:7px;padding:9px;border:1px solid var(--df-border);border-radius:12px;background:var(--df-layer-2);overflow:hidden}
.df-assistant__control label{flex:none;font-size:10px;color:var(--df-ink-2)}
.df-assistant__control input,.df-assistant__preview textarea{width:100%;border:1px solid var(--df-border-strong);border-radius:8px;background:var(--df-layer-2);color:var(--df-ink);padding:7px 9px;outline:0}
.df-assistant__control input:focus,.df-assistant__preview textarea:focus{border-color:var(--df-brand)}
.df-assistant__summary{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--df-ink-2);min-height:24px}
.df-count{appearance:none;padding:2px 7px;border-radius:999px;background:var(--df-layer-2);border:1px solid var(--df-border);font-size:9px;line-height:1.4;cursor:pointer}
.df-count.is-error{color:var(--df-err)}
.df-count.is-warning{color:var(--df-warn)}
.df-count:hover,.df-count:focus-visible{border-color:currentColor;outline:0}
.df-count.is-active{background:color-mix(in srgb,currentColor 14%,var(--df-layer-2));border-color:currentColor;box-shadow:inset 0 0 0 1px currentColor}
.df-findings{flex:1 1 0;height:0;min-height:0;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:5px;padding-right:3px;scrollbar-width:thin}
.df-finding{display:grid;grid-template-columns:7px minmax(0,1fr);gap:7px;width:100%;text-align:left;border:0;border-radius:7px;background:var(--df-layer-2);color:var(--df-ink);padding:6px 8px}
.df-finding:hover{background:color-mix(in srgb,var(--df-brand) 7%,var(--df-layer-2))}
.df-finding__dot{width:7px;height:7px;border-radius:50%;margin-top:5px;background:var(--df-ink-2)}
.df-finding.is-error .df-finding__dot{background:var(--df-err)}
.df-finding.is-warning .df-finding__dot{background:var(--df-warn)}
.df-finding__doc{display:block;color:var(--df-brand);font:8px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.df-finding__message{display:block;font-size:10px;line-height:1.4}
.df-finding__suggestion{display:block;color:var(--df-ink-2);font-size:9px;line-height:1.35;margin-top:2px}
.df-assistant__preview{min-width:0;min-height:0;display:flex;flex-direction:column;border:1px solid var(--df-border);border-radius:12px;background:var(--df-bg);overflow:hidden}
.df-assistant__preview-head{position:sticky;z-index:2;top:0;flex:none;min-height:40px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 9px;border-bottom:1px solid var(--df-border);background:var(--df-layer-2);font-size:10px;color:var(--df-ink-2)}
.df-assistant__preview-head>span:last-child{display:inline-flex;align-items:center;gap:6px}
.df-assistant__preview-title{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-assistant__preview textarea{flex:1;min-height:0;resize:none;overflow:auto;overscroll-behavior:contain;border:0;border-radius:0 0 12px 12px;padding:10px 12px;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--df-bg);scrollbar-width:thin}
.df-assistant__pending{flex:1;min-height:0;display:grid;place-items:center;padding:18px;color:var(--df-ink-2);font-size:11px;text-align:center;overflow:auto}
.df-confirm-backdrop{position:absolute;z-index:40;inset:0;display:grid;place-items:center;padding:20px;background:color-mix(in srgb,var(--df-bg) 72%,transparent);backdrop-filter:blur(4px)}
.df-confirm{width:min(540px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:18px;border:1px solid var(--df-border-strong);border-radius:14px;background:var(--df-layer);box-shadow:0 20px 60px color-mix(in srgb,var(--df-ink) 18%,transparent)}
.df-confirm h3{margin:0 0 8px;font-size:15px;color:var(--df-ink)}
.df-confirm p{margin:0;color:var(--df-ink-2);font-size:12px;line-height:1.65}
.df-confirm__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.df-topology-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}
.df-topology-summary span{padding:8px 10px;border:1px solid var(--df-border);border-radius:9px;background:var(--df-layer-2);color:var(--df-ink-2);font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.df-gate-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:14px}
.deepseek-flow-root .df-gate-choice{display:flex;min-height:82px;flex-direction:column;align-items:flex-start;gap:5px;text-align:left;border:1px solid var(--df-border-strong);border-radius:11px;background:var(--df-layer-2);color:var(--df-ink);padding:11px;cursor:pointer}
.deepseek-flow-root .df-gate-choice:hover,.deepseek-flow-root .df-gate-choice:focus-visible{border-color:var(--df-brand);background:color-mix(in srgb,var(--df-brand) 7%,var(--df-layer-2));outline:0}
.df-gate-choice strong{font-size:12px;color:var(--df-brand)}
.df-gate-choice span{font-size:10px;line-height:1.45;color:var(--df-ink-2)}
.df-branch-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.deepseek-flow-root .df-branch-option{min-height:54px;border:1px solid var(--df-border-strong);border-radius:11px;background:var(--df-layer-2);color:var(--df-ink);font-size:14px;font-weight:750;cursor:pointer}
.deepseek-flow-root .df-branch-option:hover:not(:disabled),.deepseek-flow-root .df-branch-option:focus-visible:not(:disabled){border-color:var(--df-brand);color:var(--df-brand);outline:0}
.deepseek-flow-root .df-branch-option:disabled{opacity:.38;cursor:not-allowed;text-decoration:line-through}
.df-import-hidden{display:none}
[data-conversation-scroll][data-deepseek-flow-immersive="true"]{--dsh-composer-height:0px!important;overflow:hidden!important}
[data-conversation-scroll][data-deepseek-flow-immersive="true"]>[data-composer-seat]{display:none!important}
[data-conversation-scroll][data-deepseek-flow-immersive="true"]>:not([data-composer-seat]){flex:1 1 0;min-height:0;height:100%}
[data-conversation-scroll][data-deepseek-flow-immersive="true"] .deepseek-flow-root{height:100%;min-height:0}
@media(max-width:1180px){.df-status{display:none}.df-assistant__target{max-width:120px}.df-titlebar__note{display:none}}
@media(max-width:760px){.df-toolbar{padding:7px}.df-assistant__head{padding:7px;overflow-x:auto}.df-assistant__target{display:none}.df-assistant__body{grid-template-columns:1fr;overflow:auto;overscroll-behavior:contain}.df-assistant__control{min-height:150px}.df-findings{height:auto;min-height:80px}.df-assistant__preview{display:flex;min-height:210px}.df-assistant__head .df-btn{padding:4px 6px}.df-assistant__title{display:none}.df-tabs{padding:0 10px}.df-titlebar__badge{display:none}.df-topology-apply{right:10px;bottom:10px}.df-topology-summary{grid-template-columns:1fr}}
`;
