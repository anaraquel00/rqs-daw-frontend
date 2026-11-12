import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';

import {
  AdminApiService,
} from '../core/admin-api.service';

import {
  ReviewActionControlComponent,
} from './review-action-control.component';

describe(
  'ReviewActionControlComponent',
  () => {
    const api = {
      requestReviewFlag:
        jasmine.createSpy(
          'requestReviewFlag',
        ),

      confirmAction:
        jasmine.createSpy(
          'confirmAction',
        ),

      cancelAction:
        jasmine.createSpy(
          'cancelAction',
        ),
    };

    beforeEach(() => {
      api.requestReviewFlag.calls.reset();
      api.confirmAction.calls.reset();
      api.cancelAction.calls.reset();
    });

    it(
      'requires explicit second confirmation before execution',
      async () => {
        api.requestReviewFlag.and.resolveTo({
          replayed: false,
          action: {
            actionId:
              '00000000-0000-4000-8000-000000000010',
            actionType:
              'review_flag.set',
            targetKind:
              'waitlist',
            targetId:
              'opaque-record-01',
            desiredState:
              'open',
            reason:
              'manual_review',
            status:
              'pending_confirmation',
            dataEnvironment:
              'staging',
            createdAt:
              '2026-11-11T20:00:00.000Z',
            confirmationExpiresAt:
              '2026-11-11T20:10:00.000Z',
            confirmedAt: null,
            executedAt: null,
            cancelledAt: null,
            expiredAt: null,
            failureCode: null,
          },
        });

        api.confirmAction.and.resolveTo({
          replayed: false,
          action: {
            actionId:
              '00000000-0000-4000-8000-000000000010',
            actionType:
              'review_flag.set',
            targetKind:
              'waitlist',
            targetId:
              'opaque-record-01',
            desiredState:
              'open',
            reason:
              'manual_review',
            status:
              'executed',
            dataEnvironment:
              'staging',
            createdAt:
              '2026-11-11T20:00:00.000Z',
            confirmationExpiresAt:
              '2026-11-11T20:10:00.000Z',
            confirmedAt:
              '2026-11-11T20:01:00.000Z',
            executedAt:
              '2026-11-11T20:01:01.000Z',
            cancelledAt: null,
            expiredAt: null,
            failureCode: null,
          },
        });

        const fixture =
          await create();

        click(
          fixture,
          '[data-testid="review-trigger"]',
        );

        expect(
          fixture.nativeElement.textContent,
        ).toContain(
          'PREPARE ACTION',
        );

        expect(
          api.confirmAction,
        ).not.toHaveBeenCalled();

        click(
          fixture,
          '[data-testid="prepare-action"]',
        );

        await settle(fixture);

        expect(
          api.requestReviewFlag,
        ).toHaveBeenCalledTimes(1);

        expect(
          api.requestReviewFlag,
        ).toHaveBeenCalledWith(
          {
            actionType:
              'review_flag.set',
            targetKind:
              'waitlist',
            targetId:
              'opaque-record-01',
            desiredState:
              'open',
            reason:
              'manual_review',
          },
          jasmine.any(String),
        );

        expect(
          api.confirmAction,
        ).not.toHaveBeenCalled();

        expect(
          fixture.nativeElement.textContent,
        ).toContain(
          'CONFIRMATION REQUIRED',
        );

        click(
          fixture,
          '[data-testid="confirm-action"]',
        );

        await settle(fixture);

        expect(
          api.confirmAction,
        ).toHaveBeenCalledTimes(1);

        expect(
          api.confirmAction,
        ).toHaveBeenCalledWith(
          '00000000-0000-4000-8000-000000000010',
          jasmine.any(String),
        );

        expect(
          fixture.nativeElement.textContent,
        ).toContain(
          'REVIEW FLAG SAVED',
        );
      },
    );

    it(
      'cancels a pending action without confirming it',
      async () => {
        api.requestReviewFlag.and.resolveTo({
          replayed: false,
          action: {
            actionId:
              '00000000-0000-4000-8000-000000000010',
            actionType:
              'review_flag.set',
            targetKind:
              'waitlist',
            targetId:
              'opaque-record-01',
            desiredState:
              'open',
            reason:
              'manual_review',
            status:
              'pending_confirmation',
            dataEnvironment:
              'staging',
            createdAt:
              '2026-11-11T20:00:00.000Z',
            confirmationExpiresAt:
              '2026-11-11T20:10:00.000Z',
            confirmedAt: null,
            executedAt: null,
            cancelledAt: null,
            expiredAt: null,
            failureCode: null,
          },
        });

        api.cancelAction.and.resolveTo({
          replayed: false,
          action: {
            actionId:
              '00000000-0000-4000-8000-000000000010',
            actionType:
              'review_flag.set',
            targetKind:
              'waitlist',
            targetId:
              'opaque-record-01',
            desiredState:
              'open',
            reason:
              'manual_review',
            status:
              'cancelled',
            dataEnvironment:
              'staging',
            createdAt:
              '2026-11-11T20:00:00.000Z',
            confirmationExpiresAt:
              '2026-11-11T20:10:00.000Z',
            confirmedAt: null,
            executedAt: null,
            cancelledAt:
              '2026-11-11T20:01:00.000Z',
            expiredAt: null,
            failureCode: null,
          },
        });

        const fixture =
          await create();

        click(
          fixture,
          '[data-testid="review-trigger"]',
        );

        click(
          fixture,
          '[data-testid="prepare-action"]',
        );

        await settle(fixture);

        click(
          fixture,
          '[data-testid="cancel-action"]',
        );

        await settle(fixture);

        expect(
          api.cancelAction,
        ).toHaveBeenCalledTimes(1);

        expect(
          api.confirmAction,
        ).not.toHaveBeenCalled();

        expect(
          fixture.nativeElement.textContent,
        ).toContain(
          'ACTION CANCELLED',
        );
      },
    );

    async function create():
      Promise<ComponentFixture<ReviewActionControlComponent>> {
      await TestBed
        .configureTestingModule({
          imports: [
            ReviewActionControlComponent,
          ],
          providers: [
            {
              provide:
                AdminApiService,
              useValue: api,
            },
          ],
        })
        .compileComponents();

      const fixture =
        TestBed.createComponent(
          ReviewActionControlComponent,
        );

      fixture.componentRef.setInput(
        'targetKind',
        'waitlist',
      );

      fixture.componentRef.setInput(
        'targetId',
        'opaque-record-01',
      );

      fixture.componentRef.setInput(
        'targetLabel',
        'an***@example.com',
      );

      fixture.detectChanges();

      return fixture;
    }

    function click(
      fixture:
        ComponentFixture<ReviewActionControlComponent>,
      selector: string,
    ): void {
      const element =
        fixture.nativeElement.querySelector(
          selector,
        ) as HTMLButtonElement;

      expect(element)
        .withContext(selector)
        .not.toBeNull();

      element.click();
      fixture.detectChanges();
    }

    async function settle(
      fixture:
        ComponentFixture<ReviewActionControlComponent>,
    ): Promise<void> {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  },
);
