import api from './api.js';

export const getCounselorName = (counselor) => counselor?.name || counselor?.username || 'Unknown';

export const buildCouncilNumberByCounselorName = (matrix) => {
  const councilByName = {};
  matrix?.councils?.forEach((council) => {
    const name = council.seniorCounselor?.split(' - ')[0]?.trim();
    if (name) {
      councilByName[name] = council.number;
    }
  });
  return councilByName;
};

export const fetchCouncilNumberByCounselorName = async () => {
  try {
    const { data: matrix } = await api.get('/api/matrices/selected');
    return buildCouncilNumberByCounselorName(matrix);
  } catch {
    return {};
  }
};

export const formatCounselorWithCouncil = (counselor, councilByName) => {
  const name = getCounselorName(counselor);
  const councilNumber = councilByName[name];
  return councilNumber ? `${name} - Council ${councilNumber}` : name;
};
