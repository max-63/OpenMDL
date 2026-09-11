// Logo OpenMDL vectoriel SVG pur inspiré du style Monoline épuré

export const BrandLogo = {
  // Logo Canette Inclinée fusionnée avec le M de MDL (monoline pur)
  svg: (className = 'w-8 h-8') => `
    <svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 100 100" fill="none">
      <g transform="rotate(-36 50 50)">
        <!-- Silhouette Canette -->
        <rect x="30" y="20" width="40" height="60" rx="10" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
        <!-- Opercule supérieure -->
        <path d="M42 20V15C42 13 45 11 50 11C55 11 58 13 58 15V20" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
        <line x1="47" y1="16" x2="53" y2="16" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
        <!-- Lettre M intégrée au corps de la canette en trait continu -->
        <path d="M38 65V40L50 54L62 40V65" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </svg>
  `,

  // Logo Canette Droite avec le M
  svgStraight: (className = 'w-8 h-8') => `
    <svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 100 100" fill="none">
      <!-- Silhouette Canette -->
      <rect x="26" y="18" width="48" height="68" rx="12" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Opercule -->
      <path d="M40 18V13C40 10 44 8 50 8C56 8 60 10 60 13V18" stroke="currentColor" stroke-width="6" stroke-linecap="round" />
      <line x1="45" y1="13" x2="55" y2="13" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
      <!-- Lettre M continue au centre -->
      <path d="M35 70V38L50 54L65 38V70" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `
};
