import React, { memo } from 'react';

// Keep page drafts mounted, but defer hidden-page prop updates until activation.
function PersistentPage({ active, className = 'block', children }) {
  return <div className={active ? className : 'hidden'}>{children}</div>;
}

export default memo(PersistentPage, (previous, next) => !previous.active && !next.active);
