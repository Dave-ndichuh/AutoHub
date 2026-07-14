'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const BranchContext = createContext({
  currentBranch: null,
  setBranch: () => {},
});

export const BranchProvider = ({ children }) => {
  const [currentBranch, setCurrentBranch] = useState(null);

  // Load branch from localStorage on initial render
  useEffect(() => {
    const savedBranch = localStorage.getItem('jobea_branch');
    if (savedBranch) {
      setCurrentBranch(savedBranch);
    }
  }, []);

  // Update localStorage when branch changes
  const setBranch = (branch) => {
    setCurrentBranch(branch);
    if (branch) {
      localStorage.setItem('jobea_branch', branch);
    } else {
      localStorage.removeItem('jobea_branch');
    }
  };

  return (
    <BranchContext.Provider value={{ currentBranch, setBranch }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};
