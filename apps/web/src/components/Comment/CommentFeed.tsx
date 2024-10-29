import { useHiddenCommentFeedStore } from "@components/Publication";
import QueuedPublication from "@components/Publication/QueuedPublication";
import SinglePublication from "@components/Publication/SinglePublication";
import PublicationsShimmer from "@components/Shared/Shimmer/PublicationsShimmer";
import { ChatBubbleLeftIcon } from "@heroicons/react/24/outline";
import type { Comment, PublicationsRequest } from "@hey/lens";
import {
  CommentRankingFilterType,
  CustomFiltersType,
  HiddenCommentsType,
  LimitType,
  usePublicationsQuery
} from "@hey/lens";
import { OptmisticPublicationType } from "@hey/types/enums";
import { Card, EmptyState, ErrorMessage } from "@hey/ui";
import type { FC } from "react";
import { Virtuoso } from "react-virtuoso";
import { useImpressionsStore } from "src/store/non-persisted/useImpressionsStore";
import { useTipsStore } from "src/store/non-persisted/useTipsStore";
import { useTransactionStore } from "src/store/persisted/useTransactionStore";

interface CommentFeedProps {
  publicationId: string;
}

const CommentFeed: FC<CommentFeedProps> = ({ publicationId }) => {
  const { txnQueue } = useTransactionStore();
  const { showHiddenComments } = useHiddenCommentFeedStore();
  const { fetchAndStoreViews } = useImpressionsStore();
  const { fetchAndStoreTips } = useTipsStore();

  const request: PublicationsRequest = {
    limit: LimitType.TwentyFive,
    where: {
      commentOn: {
        hiddenComments: showHiddenComments
          ? HiddenCommentsType.HiddenOnly
          : HiddenCommentsType.Hide,
        id: publicationId,
        ranking: { filter: CommentRankingFilterType.Relevant }
      },
      customFilters: [CustomFiltersType.Gardeners]
    }
  };

  const { data, error, fetchMore, loading } = usePublicationsQuery({
    onCompleted: async ({ publications }) => {
      const ids = publications?.items?.map((p) => p.id) || [];
      await fetchAndStoreViews(ids);
      await fetchAndStoreTips(ids);
    },
    skip: !publicationId,
    variables: { request }
  });

  const comments = data?.publications?.items ?? [];
  const pageInfo = data?.publications?.pageInfo;
  const hasMore = pageInfo?.next;

  const queuedComments = txnQueue.filter(
    (o) =>
      o.type === OptmisticPublicationType.Comment &&
      o.commentOn === publicationId
  );
  const queuedCount = queuedComments.length;
  const hiddenCount = comments.filter(
    (o) => o?.__typename === "Comment" && o.isHidden
  ).length;
  const hiddenRemovedComments = comments?.length - hiddenCount;
  const totalComments = hiddenRemovedComments + queuedCount;

  const onEndReached = async () => {
    if (hasMore) {
      const { data } = await fetchMore({
        variables: { request: { ...request, cursor: pageInfo?.next } }
      });
      const ids = data?.publications?.items?.map((p) => p.id) || [];
      await fetchAndStoreViews(ids);
      await fetchAndStoreTips(ids);
    }
  };

  if (loading) {
    return <PublicationsShimmer />;
  }

  if (error) {
    return <ErrorMessage error={error} title="Failed to load comment feed" />;
  }

  if (totalComments === 0) {
    return (
      <EmptyState
        icon={<ChatBubbleLeftIcon className="size-8" />}
        message="Be the first one to comment!"
      />
    );
  }

  return (
    <>
      {queuedComments.map((txn) => (
        <QueuedPublication key={txn.txId} txn={txn} />
      ))}
      <Card>
        <Virtuoso
          className="virtual-divider-list-window"
          computeItemKey={(index, comment) =>
            `${publicationId}-${comment.id}-${index}`
          }
          data={comments}
          endReached={onEndReached}
          itemContent={(index, comment) => {
            if (comment?.__typename !== "Comment" || comment.isHidden) {
              return null;
            }

            const isFirst = index === 0;
            const isLast = index === comments.length - 1;

            return (
              <SinglePublication
                isFirst={isFirst}
                isLast={isLast}
                publication={comment as Comment}
                showType={false}
              />
            );
          }}
          useWindowScroll
        />
      </Card>
    </>
  );
};

export default CommentFeed;