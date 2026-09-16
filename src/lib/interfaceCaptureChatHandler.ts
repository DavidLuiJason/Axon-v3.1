import { ScreenId } from '../types';
import {
  resolveInterfaceFromQuery,
  getSafeInterfaceFileName,
  AXON_INTERFACES,
} from './interfaceRegistry';
import {
  captureLiveCurrentInterface,
  captureInterfaceById,
  captureAllInterfaces,
  stitchCanvasesVertically,
  exportCapturesToPdf,
  triggerCaptureDownload,
  CapturedInterfaceResult,
} from './interfaceCaptureEngine';

export interface InterfaceCaptureChatResult {
  handled: boolean;
  executed?: boolean;
  response: string;
  attachments?: Array<{
    name: string;
    type: string;
    dataUrl: string;
    size?: string;
  }>;
}

/**
 * Evaluates whether a user chat message is requesting an interface capture,
 * and if so, orchestrates the real DOM-to-image capture and returns the result.
 */
export async function evaluateInterfaceCaptureChatCommand(
  text: string,
  context: {
    currentScreen: ScreenId;
    previousScreen?: ScreenId;
  }
): Promise<InterfaceCaptureChatResult> {
  const lower = text.trim().toLowerCase();

  // Guard: Check if the text matches capture intents
  const hasCaptureKeyword =
    lower.includes('capture') ||
    lower.includes('give me an image') ||
    lower.includes('show me the actual') ||
    lower.includes('what does the') && lower.includes('look like') ||
    lower.includes('export all interfaces') ||
    lower.includes('make one long image') ||
    lower.includes('make a pdf containing') ||
    lower.includes('make a pdf of all') ||
    lower.includes('pdf of all interfaces') ||
    lower.includes('interfaces as images');

  if (!hasCaptureKeyword) {
    return { handled: false, response: '' };
  }

  // Resolve intent against registry
  const resolution = resolveInterfaceFromQuery(lower, context.currentScreen);

  // 1. Ambiguous query handling (Requirement 9)
  if (resolution.isAmbiguous) {
    const list = (resolution.candidates || AXON_INTERFACES.slice(0, 5))
      .map((c) => `- **${c.name}** (${c.category})`)
      .join('\n');

    return {
      handled: true,
      executed: false,
      response: `I couldn't uniquely identify which interface you would like to capture${
        resolution.unrecognizedName ? ` for "${resolution.unrecognizedName}"` : ''
      }.\n\nDid you mean one of these registered interfaces?\n${list}\n\nYou can say, for example, *"Capture Settings"*, *"Give me an image of AXON Code"*, or *"Capture all interfaces"*.`,
    };
  }

  // 2. All Interfaces Capture (Requirement 10, 12, 14)
  if (resolution.isAll) {
    try {
      const isPdf = resolution.isPdf || lower.includes('pdf');
      const isLongImage = resolution.isLongImage || lower.includes('long image') || lower.includes('stitch');

      const report = await captureAllInterfaces({
        fullHeight: true,
        format: 'png',
      });

      if (report.results.length === 0) {
        return {
          handled: true,
          executed: false,
          response: `AXON attempted to capture all interfaces, but no interfaces were rendered successfully. Failures: ${report.failures.map((f) => `${f.name}: ${f.error}`).join('; ')}`,
        };
      }

      const attachments: Array<{ name: string; type: string; dataUrl: string; size?: string }> = [];

      // If PDF export requested
      if (isPdf) {
        const pdfDoc = await exportCapturesToPdf(report.results, 'AXON_Interface_Documentation.pdf');
        triggerCaptureDownload(pdfDoc.dataUrl, pdfDoc.filename);

        attachments.push({
          name: pdfDoc.filename,
          type: 'application/pdf',
          dataUrl: pdfDoc.dataUrl,
          size: `${report.results.length} pages`,
        });

        // Also include the first interface as visual preview
        attachments.push({
          name: getSafeInterfaceFileName(report.results[0].name, 'png'),
          type: 'image/png',
          dataUrl: report.results[0].dataUrl,
          size: report.results[0].formattedSize,
        });

        let summaryText = `### AXON Interface Documentation (PDF)\n\n` +
          `Successfully captured **${report.successfulCount} interfaces** from AXON's navigation hierarchy and compiled them into a multi-page PDF document:\n\n` +
          `• **Document**: \`AXON_Interface_Documentation.pdf\` (${report.successfulCount} pages)\n` +
          `• **Status**: Download initiated and file attached below.\n\n`;

        if (report.failedCount > 0) {
          summaryText += `*Note: ${report.failedCount} interface(s) could not be captured: ${report.failures.map((f) => f.name).join(', ')}.*\n\n`;
        }

        summaryText += `![Preview: ${report.results[0].name}](${report.results[0].dataUrl})`;

        return {
          handled: true,
          executed: true,
          response: summaryText,
          attachments,
        };
      }

      // If Long Image export requested
      if (isLongImage) {
        const stitched = await stitchCanvasesVertically(report.results, { format: 'png' });
        triggerCaptureDownload(stitched.dataUrl, stitched.filename);

        attachments.push({
          name: stitched.filename,
          type: 'image/png',
          dataUrl: stitched.dataUrl,
          size: `${stitched.width}x${stitched.height}px`,
        });

        let summaryText = `### AXON All-Interfaces Long Image\n\n` +
          `Captured and vertically stitched **${report.successfulCount} interfaces** into a continuous long image:\n\n` +
          `• **File**: \`${stitched.filename}\` (${stitched.width}x${stitched.height}px)\n` +
          `• **Status**: Download initiated.\n\n` +
          `![AXON All Interfaces](${stitched.dataUrl})`;

        return {
          handled: true,
          executed: true,
          response: summaryText,
          attachments,
        };
      }

      // Standard All-Interfaces capture: Attach top captures and provide overview
      for (const item of report.results.slice(0, 6)) {
        attachments.push({
          name: getSafeInterfaceFileName(item.name, 'png'),
          type: 'image/png',
          dataUrl: item.dataUrl,
          size: item.formattedSize,
        });
      }

      let responseText = `### AXON Interface Capture Complete\n\n` +
        `Successfully captured **${report.successfulCount} real interfaces** across AXON in navigation hierarchy order:\n\n`;

      for (let i = 0; i < report.results.length; i++) {
        const item = report.results[i];
        responseText += `${i + 1}. **${item.name}** — ${item.width}x${item.height}px (${item.formattedSize})\n`;
      }

      if (report.failedCount > 0) {
        responseText += `\n*Note: ${report.failedCount} interface(s) encountered rendering issues: ${report.failures.map((f) => `${f.name} (${f.error})`).join(', ')}*\n`;
      }

      responseText += `\nHere is a preview of **${report.results[0].name}**:\n\n` +
        `![${report.results[0].name}](${report.results[0].dataUrl})\n\n` +
        `*Click any attached thumbnail above to view in full resolution or download individual files.*`;

      return {
        handled: true,
        executed: true,
        response: responseText,
        attachments,
      };
    } catch (err: any) {
      return {
        handled: true,
        executed: false,
        response: `An error occurred during all-interface capture: ${err?.message || 'Capture system error'}.`,
      };
    }
  }

  // 3. Current Interface Capture (Requirement 4)
  if (resolution.isCurrent || (resolution.match && resolution.match.id === context.currentScreen)) {
    try {
      const targetRoute =
        context.previousScreen && context.previousScreen !== 'tool_interface_capture'
          ? context.previousScreen
          : context.currentScreen;

      const result = await captureLiveCurrentInterface(targetRoute, {
        fullHeight: true,
        format: 'png',
      });

      const filename = getSafeInterfaceFileName(result.name, 'png');

      const attachments = [
        {
          name: filename,
          type: 'image/png',
          dataUrl: result.dataUrl,
          size: result.formattedSize,
        },
      ];

      return {
        handled: true,
        executed: true,
        response: `Captured the actual rendered view of **${result.name}**:\n\n` +
          `• **Resolution**: ${result.width} × ${result.height}px\n` +
          `• **File Size**: ${result.formattedSize}\n` +
          `• **Source**: Live AXON DOM Rendering\n\n` +
          `![${result.name}](${result.dataUrl})`,
        attachments,
      };
    } catch (err: any) {
      return {
        handled: true,
        executed: false,
        response: `Failed to capture current interface: ${err?.message || 'Rendering error'}.`,
      };
    }
  }

  // 4. Specific Interface Capture by Name (Requirement 9, 14)
  if (resolution.match) {
    try {
      const meta = resolution.match;
      const result = await captureInterfaceById(meta.id, {
        fullHeight: true,
        format: 'png',
      });

      const filename = getSafeInterfaceFileName(result.name, 'png');
      const attachments = [
        {
          name: filename,
          type: 'image/png',
          dataUrl: result.dataUrl,
          size: result.formattedSize,
        },
      ];

      return {
        handled: true,
        executed: true,
        response: `Captured the actual **${result.name}** interface:\n\n` +
          `• **Category**: ${result.category}\n` +
          `• **Resolution**: ${result.width} × ${result.height}px\n` +
          `• **File Size**: ${result.formattedSize}\n` +
          `• **Source**: AXON Component Hierarchy (${result.route})\n\n` +
          `![${result.name}](${result.dataUrl})`,
        attachments,
      };
    } catch (err: any) {
      return {
        handled: true,
        executed: false,
        response: `Could not capture the "${resolution.match.name}" interface: ${err?.message || 'Rendering error'}.`,
      };
    }
  }

  return { handled: false, response: '' };
}
