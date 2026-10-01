package com.group6.auction.product.repository;

import com.group6.auction.product.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from Product p where p.id = :id")
    java.util.Optional<Product> findForUpdate(@org.springframework.data.repository.query.Param("id") long id);

    @org.springframework.data.jpa.repository.Query("select p from Product p where lower(p.name) like lower(:pattern) escape '!' or p.id = :exactId")
    org.springframework.data.domain.Page<Product> search(@org.springframework.data.repository.query.Param("pattern") String pattern,
        @org.springframework.data.repository.query.Param("exactId") long exactId, org.springframework.data.domain.Pageable pageable);

    @org.springframework.data.jpa.repository.Query(value="select distinct product_id from auctions where product_id in (:ids)", nativeQuery=true)
    java.util.List<Long> usedIds(@org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);
}
