// @vitest-environment happy-dom

import { createApp, defineComponent, h, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { initSetupVbenForm, useVbenForm } from '../../form';
import { initComponentAdapter } from '../index';

function findInvalidLabels(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLLabelElement>('label[for]')]
    .filter((label) => {
      const target = document.querySelector(`#${CSS.escape(label.htmlFor)}`);
      return !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      );
    })
    .map((label) => label.htmlFor);
}

describe('form label association', () => {
  it('keeps native and grouped controls correctly labelled', async () => {
    await initComponentAdapter();
    await initSetupVbenForm();
    const TestForm = defineComponent({
      setup() {
        const [Form] = useVbenForm({
          schema: [
            {
              component: 'Select',
              componentProps: {
                options: [{ label: 'Enabled', value: 1 }],
              },
              fieldName: 'status',
              label: 'Status',
            },
            {
              component: 'Input',
              fieldName: 'keyword',
              label: 'Keyword',
            },
            {
              component: 'ApiTreeSelect',
              componentProps: {
                options: [{ label: 'Admin', value: 1 }],
              },
              fieldName: 'roleID',
              label: 'Role',
            },
            {
              component: 'JsonEditor',
              fieldName: 'payload',
              label: 'Payload',
            },
            {
              component: 'RadioGroup',
              componentProps: {
                options: [
                  { label: 'Enabled', value: 1 },
                  { label: 'Disabled', value: 0 },
                ],
                optionType: 'button',
              },
              fieldName: 'availability',
              label: 'Availability',
            },
          ],
          showDefaultActions: false,
        });
        return () => h(Form);
      },
    });

    const container = document.createElement('div');
    document.body.append(container);
    const app = createApp(TestForm);
    const invalidSnapshots: string[][] = [];
    const observer = new MutationObserver(() => {
      invalidSnapshots.push(findInvalidLabels(container));
    });
    observer.observe(container, { childList: true, subtree: true });

    app.mount(container);
    invalidSnapshots.push(findInvalidLabels(container));
    await vi.waitFor(
      async () => {
        await nextTick();
        const labels = container.querySelectorAll('label[for]');
        expect(labels).toHaveLength(4);
        expect(findInvalidLabels(container)).toEqual([]);
        const radioGroup = container.querySelector<HTMLElement>(
          '[role="radiogroup"]',
        );
        const groupLabelId = radioGroup?.getAttribute('aria-labelledby');
        expect(groupLabelId).toBeTruthy();
        expect(
          document.querySelector(
            groupLabelId ? `#${CSS.escape(groupLabelId)}` : '',
          )?.textContent,
        ).toContain('Availability');
      },
      { timeout: 5000 },
    );

    observer.disconnect();
    expect(invalidSnapshots.every((snapshot) => snapshot.length === 0)).toBe(
      true,
    );
    app.unmount();
    container.remove();
  });
});
