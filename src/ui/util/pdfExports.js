import { jsPDF } from 'jspdf';
import {
  fetchCouncilNumberByCounselorName,
  formatCounselorWithCouncil,
  getCounselorName,
} from './council.js';

const formatCounselorTitle = (counselor, councilByName, label) => {
  const baseTitle = formatCounselorWithCouncil(counselor, councilByName);
  return label ? `${baseTitle} (${label})` : baseTitle;
};

const formatActivityTitle = (activityName, seniorCounselors) => {
  const counselors = Array.isArray(seniorCounselors) ? seniorCounselors : [seniorCounselors];
  const counselorNames = counselors
    .filter(Boolean)
    .map(getCounselorName)
    .filter((name) => name && name !== 'Unknown');
  if (counselorNames.length === 0) {
    return activityName;
  }
  return `${activityName} - ${counselorNames.join(' & ')}`;
};

/**
 * Exports workshop submissions to PDF
 * @param {Array|Object} submissions - Array of submission objects or a single submission object with _seniorCounselor and assignments
 */
export const exportWorkshopSubmissions = async (submissions) => {
  const doc = new jsPDF();
  const submissionsByCounselor = {};
  const councilByName = await fetchCouncilNumberByCounselorName();
  
  // Normalize to array
  const submissionsArray = Array.isArray(submissions) ? submissions : [submissions];
  const isSingle = !Array.isArray(submissions);
  
  // Group submissions by senior counselor
  submissionsArray.forEach(submission => {
    if (submission._seniorCounselor) {
      const counselorId = submission._seniorCounselor._id.toString();
      if (!submissionsByCounselor[counselorId]) {
        submissionsByCounselor[counselorId] = {
          counselor: submission._seniorCounselor,
          submission: submission
        };
      }
    }
  });

  // Sort by counselor name
  const sortedSubmissions = Object.values(submissionsByCounselor).sort((a, b) => {
    const nameA = a.counselor.name || a.counselor.username || '';
    const nameB = b.counselor.name || b.counselor.username || '';
    return nameA.localeCompare(nameB);
  });

  sortedSubmissions.forEach((item, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const counselorTitle = formatCounselorTitle(item.counselor, councilByName, 'Workshops');
    
    // Add title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(counselorTitle, 14, 20);

    // Add table headers
    const startY = 35;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Name', 14, startY);
    doc.text('Workshop 1', 70, startY);
    doc.text('Workshop 2', 130, startY);

    // Draw header line
    doc.setLineWidth(0.5);
    doc.line(14, startY + 3, 196, startY + 3);

    // Add assignment rows
    let currentY = startY + 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    if (!item.submission.assignments || item.submission.assignments.length === 0) {
      doc.text('No assignments', 20, currentY);
    } else {
      item.submission.assignments.forEach((assignment, idx) => {
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;
        }

        const name = assignment.name || '';
        const workshop1 = assignment.workshop1?.name || 'N/A';
        const workshop2 = assignment.workshop2?.name || 'N/A';

        // Split long text if needed
        const nameLines = doc.splitTextToSize(name, 50);
        const workshop1Lines = doc.splitTextToSize(workshop1, 55);
        const workshop2Lines = doc.splitTextToSize(workshop2, 55);

        const maxLines = Math.max(nameLines.length, workshop1Lines.length, workshop2Lines.length);
        const lineHeight = 7;

        for (let i = 0; i < maxLines; i++) {
          if (i < nameLines.length) {
            doc.text(nameLines[i], 14, currentY + (i * lineHeight));
          }
          if (i < workshop1Lines.length) {
            doc.text(workshop1Lines[i], 70, currentY + (i * lineHeight));
          }
          if (i < workshop2Lines.length) {
            doc.text(workshop2Lines[i], 130, currentY + (i * lineHeight));
          }
        }

        currentY += maxLines * lineHeight + 3;
      });
    }
  });

  // Use specific filename for single submission, generic for multiple
  if (isSingle && sortedSubmissions.length === 1) {
    const counselorName = sortedSubmissions[0].counselor.name || sortedSubmissions[0].counselor.username || 'Unknown';
    const fileName = `submission-${counselorName.replace(/\s+/g, '-')}.pdf`;
    doc.save(fileName);
  } else {
    doc.save('workshop-submissions.pdf');
  }
};

/**
 * Exports workshop enrollments to PDF
 * @param {Array|Object} enrollments - Array of enrollment objects or a single enrollment object with workshop, session1, session2, etc.
 */
export const exportWorkshopEnrollments = (enrollments) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftColumnX = 14;
  const rightColumnX = pageWidth / 2 + 7;
  const columnWidth = (pageWidth / 2) - 20;
  
  // Normalize to array
  const enrollmentsArray = Array.isArray(enrollments) ? enrollments : [enrollments];
  const isSingle = !Array.isArray(enrollments);
  
  enrollmentsArray.forEach((enrollment, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const workshopName = enrollment.workshop.name;
    const enrollmentTitle = formatActivityTitle(workshopName, [
      enrollment.workshop._seniorCounselor,
      enrollment.workshop._seniorCounselor2,
    ]);
    
    // Add title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(enrollmentTitle, 14, 20);

    // Session 1 - Left Column
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Session 1 (${enrollment.session1Count} ${enrollment.session1Count === 1 ? 'person' : 'people'})`, leftColumnX, 40);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let session1Y = 50;

    if (enrollment.session1.length === 0) {
      doc.text('No enrollments', leftColumnX + 6, session1Y);
      session1Y += 10;
    } else {
      enrollment.session1.forEach((item, idx) => {
        if (session1Y > 270) {
          doc.addPage();
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(`Session 1 (continued)`, leftColumnX, 20);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          session1Y = 30;
        }
        const nameText = `${idx + 1}. ${item.name}`;
        const lines = doc.splitTextToSize(nameText, columnWidth);
        doc.text(lines, leftColumnX + 6, session1Y);
        session1Y += lines.length * 7;
      });
    }

    // Session 2 - Right Column
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Session 2 (${enrollment.session2Count} ${enrollment.session2Count === 1 ? 'person' : 'people'})`, rightColumnX, 40);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let session2Y = 50;

    if (enrollment.session2.length === 0) {
      doc.text('No enrollments', rightColumnX + 6, session2Y);
    } else {
      enrollment.session2.forEach((item, idx) => {
        if (session2Y > 270) {
          doc.addPage();
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(`Session 2 (continued)`, rightColumnX, 20);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          session2Y = 30;
        }
        const nameText = `${idx + 1}. ${item.name}`;
        const lines = doc.splitTextToSize(nameText, columnWidth);
        doc.text(lines, rightColumnX + 6, session2Y);
        session2Y += lines.length * 7;
      });
    }
  });

  // Use specific filename for single enrollment, generic for multiple
  if (isSingle && enrollmentsArray.length === 1) {
    const workshopName = enrollmentsArray[0].workshop.name;
    const fileName = `enrollment-${workshopName.replace(/\s+/g, '-')}.pdf`;
    doc.save(fileName);
  } else {
    doc.save('workshop-enrollments.pdf');
  }
};

/**
 * Exports committee submissions to PDF
 * @param {Array|Object} submissions - Array of submission objects or a single submission object with _seniorCounselor and assignments
 */
export const exportCommitteeSubmissions = async (submissions) => {
  const doc = new jsPDF();
  const submissionsByCounselor = {};
  const councilByName = await fetchCouncilNumberByCounselorName();
  
  // Normalize to array
  const submissionsArray = Array.isArray(submissions) ? submissions : [submissions];
  const isSingle = !Array.isArray(submissions);
  
  // Group submissions by senior counselor
  submissionsArray.forEach(submission => {
    if (submission._seniorCounselor) {
      const counselorId = submission._seniorCounselor._id.toString();
      if (!submissionsByCounselor[counselorId]) {
        submissionsByCounselor[counselorId] = {
          counselor: submission._seniorCounselor,
          submission: submission
        };
      }
    }
  });

  // Sort by counselor name
  const sortedSubmissions = Object.values(submissionsByCounselor).sort((a, b) => {
    const nameA = a.counselor.name || a.counselor.username || '';
    const nameB = b.counselor.name || b.counselor.username || '';
    return nameA.localeCompare(nameB);
  });

  sortedSubmissions.forEach((item, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const counselorTitle = formatCounselorTitle(item.counselor, councilByName, 'Committees');
    
    // Add title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(counselorTitle, 14, 20);

    // Add table headers
    const startY = 35;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Name', 14, startY);
    doc.text('Committee', 80, startY);

    // Draw header line
    doc.setLineWidth(0.5);
    doc.line(14, startY + 3, 196, startY + 3);

    // Add assignment rows
    let currentY = startY + 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    if (!item.submission.assignments || item.submission.assignments.length === 0) {
      doc.text('No assignments', 20, currentY);
    } else {
      item.submission.assignments.forEach((assignment, idx) => {
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;
        }

        const name = assignment.name || '';
        const committee = assignment.committee?.name || 'N/A';

        // Split long text if needed
        const nameLines = doc.splitTextToSize(name, 60);
        const committeeLines = doc.splitTextToSize(committee, 100);

        const maxLines = Math.max(nameLines.length, committeeLines.length);
        const lineHeight = 7;

        for (let i = 0; i < maxLines; i++) {
          if (i < nameLines.length) {
            doc.text(nameLines[i], 14, currentY + (i * lineHeight));
          }
          if (i < committeeLines.length) {
            doc.text(committeeLines[i], 80, currentY + (i * lineHeight));
          }
        }

        currentY += maxLines * lineHeight + 3;
      });
    }
  });

  // Use specific filename for single submission, generic for multiple
  if (isSingle && sortedSubmissions.length === 1) {
    const counselorName = sortedSubmissions[0].counselor.name || sortedSubmissions[0].counselor.username || 'Unknown';
    const fileName = `committee-submission-${counselorName.replace(/\s+/g, '-')}.pdf`;
    doc.save(fileName);
  } else {
    doc.save('committee-submissions.pdf');
  }
};

/**
 * Exports committee enrollments to PDF
 * @param {Array|Object} enrollments - Array of enrollment objects or a single enrollment object with committee and names
 */
export const exportCommitteeEnrollments = (enrollments) => {
  const doc = new jsPDF();
  
  // Normalize to array
  const enrollmentsArray = Array.isArray(enrollments) ? enrollments : [enrollments];
  const isSingle = !Array.isArray(enrollments);
  
  enrollmentsArray.forEach((enrollment, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const committeeName = enrollment.committee.name;
    const enrollmentTitle = formatActivityTitle(committeeName, enrollment.committee._seniorCounselor);
    
    // Add title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(enrollmentTitle, 14, 20);

    // Add subtitle with count
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total: ${enrollment.count} ${enrollment.count === 1 ? 'person' : 'people'}`, 14, 35);

    // List names
    let currentY = 50;
    doc.setFontSize(10);

    if (enrollment.names.length === 0) {
      doc.text('No enrollments', 20, currentY);
    } else {
      enrollment.names.forEach((item, idx) => {
        if (currentY > 270) {
          doc.addPage();
          doc.setFontSize(18);
          doc.setFont('helvetica', 'bold');
          doc.text(`${enrollmentTitle} (continued)`, 14, 20);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          currentY = 30;
        }
        const nameText = `${idx + 1}. ${item.name}`;
        const lines = doc.splitTextToSize(nameText, 180);
        doc.text(lines, 20, currentY);
        currentY += lines.length * 7;
      });
    }
  });

  // Use specific filename for single enrollment, generic for multiple
  if (isSingle && enrollmentsArray.length === 1) {
    const committeeName = enrollmentsArray[0].committee.name;
    const fileName = `committee-enrollment-${committeeName.replace(/\s+/g, '-')}.pdf`;
    doc.save(fileName);
  } else {
    doc.save('committee-enrollments.pdf');
  }
};
