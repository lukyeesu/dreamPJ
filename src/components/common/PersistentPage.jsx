import React, { createContext, memo } from 'react';

export const PageActiveContext = createContext(true);

// Keep page drafts mounted, but defer hidden-page prop updates until activation.
function PersistentPage({ active, className = 'block', children }) {
  return (
    <PageActiveContext.Provider value={Boolean(active)}>
      <div className={active ? className : 'hidden'}>{children}</div>
    </PageActiveContext.Provider>
  );
}

const MemoizedPersistentPage = memo(PersistentPage, (previous, next) => !previous.active && !next.active);
MemoizedPersistentPage.PageActiveContext = PageActiveContext;

export default MemoizedPersistentPage;
