
# caches.c
This is a simple program to expose the behavior of cache hits/misses.

We build two big matrices and multiply them. This involves 3 for-loops:
2 to traverse the resultant matrix and 1 to perform the "dot product" between
rows and columns.

The order in which these loops are written does not affect the end result,
but it does affect greatly the performance of the program.

    #include <stdlib.h>
    #include <stdio.h>
    #include <time.h>
    #include <math.h>
    #include <sys/time.h>


    #ifndef SIZE
    #define SIZE 1024
    #endif

    #ifndef MAX
    #define MAX 32
    #endif

    int main(int argc, char const *argv[]) {

We build the matrices in a random fashion, so we seed `rand`.

        {
            time_t t;
            srand((unsigned) time(&t));
        }

        struct timeval tval_before, tval_after, tval_result;

By using pointers, we lose insight on the memory arrangement, but the points are mostly valid.

        float** a = malloc(SIZE * sizeof(float*));
        float** b = malloc(SIZE * sizeof(float*));
        float** c = malloc(SIZE * sizeof(float*));
        float** d = malloc(SIZE * sizeof(float*));

        for (int i = 0; i < SIZE; ++i) {
            a[i] = malloc(SIZE * sizeof(float));
            b[i] = malloc(SIZE * sizeof(float));
            c[i] = malloc(SIZE * sizeof(float));
            d[i] = malloc(SIZE * sizeof(float));
            for (int j = 0; j < SIZE; ++j) {
                a[i][j] = (float) ((rand() % MAX) - MAX/2);
                b[i][j] = (float) (rand() % MAX - MAX/2);
            }
        }


        printf("Multiplying...\n");



       gettimeofday(&tval_before, NULL);

This is the usual way to write a matrix product, as a mathematician would do it: for each pair `i, j`, corresponding to an entry in the result, perform the "dot product" between row `i` from `a` and row `j` from `b`.

This is slow because the cache accesses are not optimized. For each `c[i][j]` we calculate, we access the element `b[k][j]` for every single `k`. We don't have further insight about the way C handles memory allocation, but we can reasonably assume that each `b[k]` access requires going to the main memory. This means 1 cache miss per `k` value.

        for (int i = 0; i < SIZE; ++i) {
            for (int j = 0; j < SIZE; ++j) {
                float result = 0;
                for (int k = 0; k < SIZE; ++k) {
                    result += a[i][k] * b[k][j];
                }
                d[i][j] = result;
            }
        }

        gettimeofday(&tval_after, NULL);
        timersub(&tval_after, &tval_before, &tval_result);
        printf("Time elapsed: %ld.%06ld\n", (long int)tval_result.tv_sec, (long int)tval_result.tv_usec);



        gettimeofday(&tval_before, NULL);

A more efficient way to perform the multiplication all the values in a row from `b` before discarding it. Given a `i, k` pair, we can compute all `a[i][k] * b[k][j]` products and add them to the respective cells, `c[i][j]`. The algorithm is almost the same as before, including its complexity. However, the number of cache misses per `i, k` is smaller, since we never perform a "big jump" by changing `j`.

        for (int i = 0; i < SIZE; ++i) {
            for (int k = 0; k < SIZE; ++k) {
                for (int j = 0; j < SIZE; ++j) {
                    if (k == 0) {
                        c[i][j] = 0;
                    }
                    c[i][j] += a[i][k]*b[k][j];
                }
            }
        }

        gettimeofday(&tval_after, NULL);
        timersub(&tval_after, &tval_before, &tval_result);
        printf("Time elapsed: %ld.%06ld\n", (long int)tval_result.tv_sec, (long int)tval_result.tv_usec);


The final result is the same.

        for (int i = 0; i < SIZE; i++) {
            for (int j = 0; j < SIZE; ++j) {
                if (c[i][j] != d[i][j]) {
                    printf("i=%d, j=%d, c=%f, d=%f\n", i, j, c[i][j], d[i][j]);
                    return 1;
                }
            }
        }

        return 0;
    }
